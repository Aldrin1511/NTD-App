import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import PatientSidebar from "@/components/PatientSidebar";
import StatusChips, { PendingSyncChip } from "@/components/StatusChips";
import { FormRenderer, DiseaseBodyChart, AdherenceGrid, RepeatableBodyExam, normalizeExamRounds, emptyExamRound, LeprosyExamSummary, isMandatoryLepExamRound, lepExamOccasion } from "@/components/FormRenderer";
import { AreaField, ChoiceRow, CheckGrid, AlertPanel, Field, ItemActions, withDrugCourse } from "@/components/Fields";
import { PhotoCapture } from "@/components/Capture";
import LeprosyReaction, { isReactionFilled } from "@/components/LeprosyReaction";
import ScabiesMedications, { scabiesTreatmentSummary, SCABIES_DRUGS, ageInMonths } from "@/components/ScabiesMedications";
import YawsMedications, { yawsTreatmentSummary } from "@/components/YawsMedications";
import LfMedications, { lfTreatmentSummary } from "@/components/LfMedications";
import BuruliMedications, { buruliTreatmentSummary } from "@/components/BuruliMedications";
import LeprosyMedications, { leprosyTreatmentSummary } from "@/components/LeprosyMedications";
import { DISEASE_SPECS, assessmentSpecs, leprosyScores, leprosyClass, yawsClass, resolveEpisodeId, isEpisodeClosed, encounterOutcome, groupDiseaseEpisodes, localISODate } from "@/mock/specs";
import { flattenMarks } from "@/lib/markFindings";
import { changedSectionKeys } from "@/sectionDiff";
import { applyMatchingRegimens, matchingRegimens, formatDosePhysical, dropVisitPosology } from "@/lib/medications";
import { RegimenBanner, AddDrugSelect, ExtraSelectedDrugs, addCatalogueDrug, DrugVisitFields } from "@/components/MedicationShared";
import { leprosyNfaGaps } from "@/components/LeprosyReactionCharts";
import { scrollViewToTop } from "@/lib/scroll";
import { useFormDirty } from "@/lib/useFormDirty";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Check, Save, ChevronDown, CircleCheck, PanelLeft, CircleHelp, Stethoscope } from "lucide-react";

const UnfoldMoreIcon = ({ className = "h-5 w-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 5.83 15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z" />
  </svg>
);

const UnfoldLessIcon = ({ className = "h-5 w-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="m7.41 18.59 1.42 1.41L12 16.83 15.17 20l1.41-1.41L12 14l-4.59 4.59zm9.18-13.18L15.17 4 12 7.17 8.83 4 7.41 5.41 12 10l4.59-4.59z" />
  </svg>
);

const empty = {
  caseDetails: {}, history: {}, marks: {}, assessment: {}, examRounds: [], photos: [], lab: {}, diagnosis: "",
  topical: [], oral: [], topicalAntibiotics: [], oralAntibiotics: [], ivermectinTabletMg: 3, sulphurStrength: "5%",
  azithromycinTabletMg: 500,
  rifampicinTabletMg: 300, clarithromycinTabletMg: 500,
  adherence: {}, household: {}, reactions: [], notes: [""], outcome: "Open", recommendations: [],
  medCourses: {},
  posology: {},
  regimenNames: [],
  regimenIds: [],
  regimenAppliedKey: "",
};

const normalizeNotes = (notes) => {
  if (Array.isArray(notes)) return notes.length ? notes : [""];
  if (typeof notes === "string" && notes.trim()) return [notes];
  return [""];
};

const VisitNotes = ({ value, onChange }) => {
  const entries = normalizeNotes(value);
  const update = (i, text) => {
    const next = [...entries];
    next[i] = text;
    onChange(next);
  };
  const addAtTop = () => {
    onChange(["", ...entries]);
  };
  const remove = (i) => {
    if (entries.length <= 1) return onChange([""]);
    onChange(entries.filter((_, j) => j !== i));
  };

  return (
    <div className="space-y-4" data-testid="visit-notes">
      {entries.map((note, i) => (
        <div key={i} className="rounded-md border border-border bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground">
              Clinical note {entries.length - i}
            </p>
            <ItemActions
              onAdd={addAtTop}
              addTestid={`visit-notes-add-${i}`}
              canRemove={entries.length > 1}
              onRemove={() => remove(i)}
              removeTestid={`visit-notes-remove-${i}`}
            />
          </div>
          <AreaField
            label=""
            rows={5}
            testid={`visit-notes-${i}`}
            value={note}
            onChange={(e) => update(i, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
};

const cloneData = (v) => {
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return v;
  }
};

const latestOpenEncounter = (encounters, patientId, disease) => {
  const diseaseEncs = (encounters || []).filter((e) => e.patientId === patientId && e.disease === disease);
  if (!diseaseEncs.length) return null;
  const episodes = groupDiseaseEpisodes(diseaseEncs, disease);
  const current = episodes[0];
  // Completed episode (Cured / Lost to Follow-up / No Leprosy / …) → blank new episode form
  if (!current || isEpisodeClosed(current.outcome)) return null;
  return current.visits[0] || null;
};

const applyLoadedEncounter = (source, disease) => {
  const cloned = cloneData(source || {});
  const base = { ...empty, ...cloned };
  ["topical", "oral", "topicalAntibiotics", "oralAntibiotics", "photos", "recommendations", "reactions", "examRounds", "notes"].forEach((k) => {
    if (base[k] == null) base[k] = cloneData(empty[k]);
  });
  if (!base.lab || typeof base.lab !== "object") base.lab = {};
  if (!base.history || typeof base.history !== "object") base.history = {};
  if (!base.caseDetails || typeof base.caseDetails !== "object") base.caseDetails = {};
  if (!base.household || typeof base.household !== "object") base.household = {};
  if (!base.adherence || typeof base.adherence !== "object") base.adherence = {};
  if (!Array.isArray(base.topical)) base.topical = [];
  if (!Array.isArray(base.oral)) base.oral = [];
  base.notes = normalizeNotes(base.notes);
  base.medCourses = base.medCourses && typeof base.medCourses === "object" ? base.medCourses : {};
  base.posology = base.posology && typeof base.posology === "object" ? base.posology : {};
  const hasPriorMeds = (cloned.topical || []).length || (cloned.oral || []).length || cloned.regimenAppliedKey;
  base.regimenAppliedKey = cloned.regimenAppliedKey || (hasPriorMeds ? "loaded" : "");
  base.regimenNames = Array.isArray(cloned.regimenNames) ? cloned.regimenNames : [];
  base.regimenIds = Array.isArray(cloned.regimenIds) ? cloned.regimenIds : [];
  const spec = DISEASE_SPECS[disease];
  if (spec?.repeatExam || base.examRounds?.length) {
    base.examRounds = normalizeExamRounds(base, spec);
    if (disease === "leprosy" && !base.examRounds[0]?.assessment && base.assessment) {
      base.examRounds = [{ ...base.examRounds[0], assessment: base.assessment, marks: base.marks || base.examRounds[0].marks }];
    }
  }
  if ((disease === "scabies" || disease === "yaws" || disease === "lf" || disease === "buruli" || disease === "leprosy") && (!base.outcome || base.outcome === "Open")) {
    base.outcome = "Active";
  }
  if (disease === "scabies") {
    const rename = {
      "Permethrin 5% cream (first-line)": SCABIES_DRUGS.permethrin,
      "Permethrin 5% cream": SCABIES_DRUGS.permethrin,
      "Permethrin 5% Cream": SCABIES_DRUGS.permethrin,
    };
    if (Array.isArray(base.topical)) {
      base.topical = base.topical.map((n) => rename[n] || n);
    }
    if (Array.isArray(base.oral)) {
      base.oral = base.oral.map((n) => (String(n).toLowerCase().includes("ivermectin") ? SCABIES_DRUGS.ivermectin : n));
    }
    if (base.diagnosis === "Clinical scabies") base.diagnosis = "Confirmed Scabies";
  }
  if (disease === "yaws" && Array.isArray(base.oral)) {
    const rename = {
      "Tab Azithromycin 500mg": "Tab Azithromycin 500mg (30mg per Kg)",
      "Oral antibiotic": null,
      "Topical antibiotic": null,
    };
    base.oral = base.oral
      .map((n) => (Object.prototype.hasOwnProperty.call(rename, n) ? rename[n] : n))
      .filter(Boolean);
    if (Array.isArray(base.topical)) {
      base.topical = base.topical.filter((n) => n !== "Topical antibiotic");
    }
  }
  if (disease === "lf") {
    if (Array.isArray(base.oral)) {
      const rename = {
        "Tab Ivermectin 3mg": "Tab Ivermectin (0.2 mg/kg)",
        "Tab Albendazole": "Tab Albendazole 200mg",
        "Tab DEC 50mg": "Tab DEC 100mg (6 mg/kg)",
      };
      base.oral = base.oral.map((n) => rename[n] || n);
    }
    if (Array.isArray(base.topical)) {
      const rename = {
        "Dressing material": "Dressing Material (Compression Bandage / Wound Care)",
        "Self-care kit": "Self care kit",
      };
      base.topical = base.topical.map((n) => rename[n] || n);
    }
    if (Array.isArray(base.recommendations)) {
      const rename = {
        "Referred for Surgery": "Surgery for Hydrocele",
      };
      base.recommendations = base.recommendations.map((n) => rename[n] || n);
    }
  }
  if (disease === "buruli" && Array.isArray(base.oral)) {
    const rename = {
      "Tab Rifampicin 300mg": "Tab Rifampicin 300mg (10mg per Kg)",
      "Tab Clarithromycin 500mg": "Tab Clarithromycin 500mg (7.5mg per kg)",
    };
    base.oral = base.oral.map((n) => rename[n] || n);
    if (base.rifampicinTabletMg == null) base.rifampicinTabletMg = 300;
    if (base.clarithromycinTabletMg == null) base.clarithromycinTabletMg = 500;
  }
  if (disease === "leprosy" && Array.isArray(base.oral)) {
    const hadMdtParts = base.oral.some((n) =>
      /dapsone|rifampicin|clofazimine|mdt/i.test(String(n)) && !/prednisolone|sdr-pep/i.test(String(n)),
    );
    const keep = base.oral.filter((n) => /prednisolone/i.test(String(n)) || /mdt blister/i.test(String(n)));
    const next = [...keep];
    if (hadMdtParts && !next.some((n) => /mdt blister/i.test(String(n)))) {
      next.push("Multi-Drug Therapy (MDT) Blister pack");
    }
    base.oral = [...new Set(next.map((n) =>
      /prednisolone/i.test(String(n)) ? "Tab Prednisolone 5mg" : n,
    ))];
  }
  return base;
};

const hasItchingComplaint = (symptoms = []) =>
  symptoms.some((s) => /itch/i.test(String(s)));

const ScabiesDiagnosisHelp = () => (
  <Dialog>
    <DialogTrigger asChild>
      <Button type="button" variant="outline" className="h-11" data-testid="diagnosis-help-btn">
        <CircleHelp className="mr-2 h-4 w-4" /> Help to Diagnosis
      </Button>
    </DialogTrigger>
    <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl" data-testid="diagnosis-help-dialog">
      <DialogHeader>
        <DialogTitle className="font-head text-xl">Help to Diagnosis</DialogTitle>
      </DialogHeader>
      <div className="space-y-5 text-sm leading-relaxed text-foreground">
        <p className="font-semibold">Please use the below information for accurate diagnosis</p>

        <div className="space-y-2">
          <p className="font-semibold">A: Confirmed scabies is diagnosed if there is at least one of:</p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li><span className="font-semibold text-foreground">A1:</span> Mites, eggs or faeces on light microscopy of skin samples</li>
            <li><span className="font-semibold text-foreground">A2:</span> Mites, eggs or faeces visualized on an individual using a high-powered imaging device</li>
            <li><span className="font-semibold text-foreground">A3:</span> Mite visualised on an individual using dermoscopy</li>
          </ul>
        </div>

        <div className="space-y-2">
          <p className="font-semibold">B: Clinical scabies is diagnosed if there is at least one of:</p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li><span className="font-semibold text-foreground">B1:</span> Scabies burrows</li>
            <li><span className="font-semibold text-foreground">B2:</span> Typical lesions affecting male genitalia</li>
            <li>
              <span className="font-semibold text-foreground">B3:</span> Typical lesions in a typical distribution and two history features
              {" "}(<span className="font-semibold text-foreground">H1:</span> Itch and <span className="font-semibold text-foreground">H2:</span> Positive contact history with an individual who has an itch or typical lesions in a typical distribution)
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <p className="font-semibold">C: Suspected scabies is diagnosed if there is one of:</p>
          <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">C1:</span> Typical lesions in a typical distribution and one history feature
              {" "}(<span className="font-semibold text-foreground">H1:</span> Itch or <span className="font-semibold text-foreground">H2:</span> Positive contact history with an individual who has an itch or typical lesions in a typical distribution)
            </li>
            <li>
              <span className="font-semibold text-foreground">C2:</span> Atypical lesions or atypical distribution and two history features
              {" "}(<span className="font-semibold text-foreground">H1:</span> Itch and <span className="font-semibold text-foreground">H2:</span> Positive contact history with an individual who has an itch or typical lesions in a typical distribution)
            </li>
          </ul>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

export default function Encounter() {
  const { id, diseaseId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { patients, encounters, suspects, saveEncounter, user, addDisease, settings, online } = useStore();
  const p = patients.find((x) => x.id === id);
  const existing = encounters.find((e) => e.id === params.get("enc"));
  const spec = DISEASE_SPECS[existing?.disease || diseaseId] || DISEASE_SPECS.scabies;
  const patientEncs = useMemo(() => encounters.filter((e) => e.patientId === id), [encounters, id]);
  /** Reaction Add only after an earlier visit in this episode already recorded one. */
  const lepReactionMode = useMemo(() => {
    if ((existing?.disease || diseaseId) !== "leprosy" || !p) {
      return { followUp: false, allowAdd: false };
    }
    const diseaseEncs = patientEncs.filter((e) => e.disease === "leprosy");
    const episodeId = resolveEpisodeId({
      existingId: existing?.episodeId,
      disease: "leprosy",
      patientEpisodeId: p.episodeId,
      diseaseEncounters: diseaseEncs,
    });
    const episodes = groupDiseaseEpisodes(diseaseEncs, "leprosy", p.episodeId);
    const episode = episodes.find((ep) => ep.id === episodeId);
    const priorVisits = (episode?.visits || []).filter((e) => e.id !== existing?.id);
    const hasPriorReaction = priorVisits.some((e) => (e.data?.reactions || []).some(isReactionFilled));
    // Show Add only when a prior visit already has reaction data; otherwise show the form to enter it.
    return {
      followUp: hasPriorReaction,
      allowAdd: hasPriorReaction,
    };
  }, [existing, diseaseId, p, patientEncs]);
  const myDiseases = useMemo(() => {
    const fromStarted = assessmentSpecs(id, { encounters: patientEncs });
    if (fromStarted.some((d) => d.id === spec.id)) return fromStarted;
    return spec.id ? [spec, ...fromStarted] : fromStarted;
  }, [id, patientEncs, spec]);

  const [d, setD] = useState(() => {
    const disease = existing?.disease || diseaseId;
    const prior = !existing ? latestOpenEncounter(encounters, id, disease) : null;
    const source = existing?.data || (prior ? prior.data : {});
    const loaded = applyLoadedEncounter(source, disease);
    if (!existing && disease === "leprosy") loaded.reactions = [];
    // New visit in an open episode: keep clinical data, restart outcome, do not carry medications
    if (!existing && prior) {
      loaded.outcome = "Active";
      loaded.topical = [];
      loaded.oral = [];
      loaded.topicalAntibiotics = [];
      loaded.oralAntibiotics = [];
      loaded.medCourses = {};
      loaded.posology = {};
      loaded.treatmentDate = "";
      loaded.regimenNames = [];
      loaded.regimenIds = [];
      // Prevent diagnosis-matched regimens from auto-selecting prior drugs again
      loaded.regimenAppliedKey = "loaded";
    }
    // Editing: honour the encounter's saved outcome (top-level or data)
    if (existing) {
      const savedOutcome = encounterOutcome(existing);
      if (savedOutcome) loaded.outcome = savedOutcome;
    }
    const fromEnc = existing?.diagnosis || prior?.diagnosis || "";
    if (!loaded.diagnosis && fromEnc) {
      loaded.diagnosis = fromEnc === "Clinical scabies" ? "Confirmed Scabies" : fromEnc;
    }
    return loaded;
  });
  const requestedSection = Number(params.get("section")) || 0;
  const [open, setOpen] = useState({});
  const [lhs, setLhs] = useState(true);
  const [savedAt, setSavedAt] = useState(existing ? "loaded from record" : "");
  const [nfaGate, setNfaGate] = useState(null);
  const [examFocus, setExamFocus] = useState({ round: null, key: 0 });
  const [cancelOpen, setCancelOpen] = useState(false);
  const facility = existing?.facility || params.get("fac") || p?.facility || "";
  const visitType = existing?.type || params.get("vt") || "Encounter";
  const referral = params.get("ref") || existing?.referral || "No";
  const set = (k) => (v) => setD((s) => ({ ...s, [k]: v }));
  const diagnosisTouchedRef = useRef(null);
  if (diagnosisTouchedRef.current === null) {
    diagnosisTouchedRef.current = Boolean(String(d.diagnosis || "").trim());
  }

  useLayoutEffect(() => {
    if (requestedSection) return undefined;
    scrollViewToTop();
    return undefined;
  }, [id, diseaseId, requestedSection]);

  useEffect(() => {
    if (!requestedSection) return undefined;
    const timer = window.setTimeout(() => {
      document.querySelector(`[data-testid="section-${requestedSection}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [requestedSection]);

  useEffect(() => {
    if (existing) return;
    if (spec.id !== "scabies") return;
    if (d.history?.itching) return;
    const fromSuspect = suspects
      .filter((s) => s.patientId === id)
      .some((s) => hasItchingComplaint(s.symptoms));
    if (fromSuspect) {
      setD((prev) => ({ ...prev, history: { ...prev.history, itching: "Yes" } }));
    }
  }, [existing, spec.id, id, suspects, d.history?.itching]);

  const weight = Number(d.caseDetails?.weight || p?.weight || 0);
  const examRounds = spec.repeatExam ? normalizeExamRounds(d, spec) : null;
  const chartMarks = examRounds
    ? examRounds.reduce((acc, r) => ({ ...acc, ...(r.marks || {}) }), {})
    : (d.marks || {});
  const leprosyAssessment = (() => {
    if (spec.id !== "leprosy") return d.assessment || {};
    const latest = examRounds?.[examRounds.length - 1];
    return { ...(latest?.assessment || d.assessment || {}), marks: latest?.marks || chartMarks };
  })();

  useEffect(() => {
    if (!nfaGate || spec.id !== "leprosy") return;
    const round = examRounds?.[nfaGate.round];
    if (round && !leprosyNfaGaps(round.assessment).incomplete) setNfaGate(null);
  }, [examRounds, nfaGate, spec.id]);
  const lepClass = spec.id === "leprosy" ? leprosyClass({ ...leprosyAssessment, ...d.lab, marks: chartMarks }) : null;
  const scores = spec.id === "leprosy" ? leprosyScores({ ...leprosyAssessment, marks: chartMarks }) : null;
  const autoDx = spec.id === "leprosy"
    ? (lepClass?.classification || "")
    : spec.id === "yaws"
      ? yawsClass(chartMarks)
      : "";
  const diagnosis = d.diagnosis || autoDx;

  useEffect(() => {
    if (spec.id !== "leprosy") return;
    if (!autoDx) return;
    if (diagnosisTouchedRef.current) return;
    if (d.diagnosis === autoDx) return;
    setD((s) => (s.diagnosis === autoDx ? s : { ...s, diagnosis: autoDx }));
  }, [autoDx, spec.id, d.diagnosis]);

  const usesActiveDefault = spec.id === "scabies" || spec.id === "yaws" || spec.id === "lf" || spec.id === "buruli" || spec.id === "leprosy";
  const noDiseaseOutcome = spec.outcomes.find((o) => o.startsWith("No ")) || "";
  const outcome = (() => {
    if (noDiseaseOutcome && (diagnosis === noDiseaseOutcome || String(diagnosis).startsWith("No "))) {
      return noDiseaseOutcome;
    }
    if (usesActiveDefault) {
      if (!d.outcome || d.outcome === "Open" || d.outcome === noDiseaseOutcome) return "Active";
      return d.outcome;
    }
    return d.outcome;
  })();

  const alerts = useMemo(() => {
    const a = [];
    const codes = flattenMarks(chartMarks).map((m) => m.code);
    if (spec.id === "scabies" && codes.includes("C")) a.push(["urgent", "🔴 Crusted skin recorded", "Consider crusted scabies — urgent clinician review and intensified treatment."]);
    if (spec.id === "buruli" && Object.values(chartMarks).some((m) => m.extra === "Category 3")) a.push(["urgent", "🔴 Category 3 lesion", "Refer for surgical assessment alongside antibiotic therapy."]);
    if (spec.id === "leprosy" && scores?.g2d === 2) a.push(["urgent", "🔴 WHO Grade 2 disability", `EHF score ${scores.ehf} — refer for MMDP and self-care.`]);
    if (spec.id === "lf" && Object.values(chartMarks).some((m) => m.extra === "Acute")) a.push(["review", "🟠 Acute secondary infection", "Treat the acute attack and start limb hygiene / self-care."]);
    const secondaryYes = examRounds
      ? examRounds.some((r) => r.secondaryInfection === "Yes")
      : d.assessment?.secondaryInfection === "Yes";
    if (secondaryYes) a.push(["review", "🟠 Secondary infection", "Add antibiotic cover per protocol."]);
    if (String(d.diagnosis).startsWith("No ")) a.push(["routine", "🟢 NTD not confirmed", "Outcome set to match the diagnosis."]);
    // if (!a.length) a.push(["routine", "🟢 Routine", "No urgent flags from the data captured so far."]);
    return a;
  }, [d, spec, scores, chartMarks, examRounds]);

  const ageMonths = ageInMonths(p || {});
  const ageYears = ageMonths != null ? ageMonths / 12 : Number(p?.age);

  useEffect(() => {
    const catalogue = settings.drugs || [];
    const regimens = settings.regimens || [];
    setD((s) => {
      const matched = matchingRegimens({
        regimens,
        disease: spec.id,
        diagnosis,
        ageYears,
        weight,
      });
      const key = matched.map((r) => r.id).sort().join("|");
      const names = matched.map((r) => r.name);
      const ids = matched.map((r) => r.id);
      if (s.regimenAppliedKey === "loaded") {
        return { ...s, regimenAppliedKey: key, regimenNames: names, regimenIds: ids };
      }
      if (s.regimenAppliedKey === key) {
        if ((s.regimenNames || []).join("|") === names.join("|")) return s;
        return { ...s, regimenNames: names, regimenIds: ids };
      }
      const patch = applyMatchingRegimens({
        regimens,
        catalogue,
        disease: spec.id,
        diagnosis,
        ageYears,
        weight,
        topical: s.topical,
        oral: s.oral,
        appliedKey: s.regimenAppliedKey,
      });
      if (!patch) return { ...s, regimenNames: names, regimenIds: ids, regimenAppliedKey: key };
      let medCourses = s.medCourses || {};
      (patch.added || []).forEach((name) => {
        medCourses = withDrugCourse(medCourses, name, true);
      });
      const { added: _added, ...rest } = patch;
      return { ...s, ...rest, medCourses };
    });
  }, [diagnosis, weight, ageYears, spec.id, settings.drugs, settings.regimens]);

  const dirtyKey = `${existing?.id || "new"}-${spec.id}-${params.get("enc") || params.get("new") || "draft"}`;
  const { dirty, markSaved } = useFormDirty(d, dirtyKey);

  if (!p) return <AppShell title="Patient not found"><Button className="h-12" onClick={() => navigate("/patients")}>Back</Button></AppShell>;

  const oralDose = (o) => {
    if (o.fixed) return o.fixed;
    if (!o.mgPerKg || !weight) return "enter weight";
    const mg = weight * o.mgPerKg;
    return `${formatDosePhysical(mg, o.tablet ? Math.round((mg / o.tablet) * 2) / 2 : null)}`;
  };

  const matchedRegimens = matchingRegimens({
    regimens: settings.regimens || [],
    disease: spec.id,
    diagnosis,
    ageYears,
    weight,
  });
  const catalogue = settings.drugs || [];

  const recordPath = () => (spec?.id ? `/patients/${p.id}/disease/${spec.id}` : `/patients/${p.id}`);

  const persist = (close) => {
    if (spec.id === "leprosy") {
      const rounds = examRounds?.length ? examRounds : [{}];
      const gapIdx = rounds.findIndex((r, idx) =>
        isMandatoryLepExamRound(r, idx, rounds) && leprosyNfaGaps(r.assessment).incomplete,
      );
      if (gapIdx >= 0) {
        const gaps = leprosyNfaGaps(rounds[gapIdx]?.assessment);
        const occasion = lepExamOccasion(rounds[gapIdx], gapIdx, rounds) || "assessment";
        setNfaGate({ round: gapIdx, target: gaps.target });
        setOpen((o) => ({ ...o, 3: true }));
        toast.error(`Complete ${occasion} — Voluntary Muscle Testing, Sensory Testing and Vision Acuity are required.`);
        window.setTimeout(() => {
          const testid = gaps.target === "vmt"
            ? `exam-${gapIdx}-assess-vmtchart`
            : gaps.target === "st"
              ? `exam-${gapIdx}-assess-sensorychart`
              : `exam-${gapIdx}-assess-visionchart`;
          document.querySelector(`[data-testid="${testid}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 220);
        return;
      }
      setNfaGate(null);
    }
    addDisease(p.id, spec.id);
    const payload = { ...d, diagnosis: diagnosis || "", outcome: outcome || "", scores };
    if (examRounds) {
      payload.examRounds = examRounds;
      payload.marks = chartMarks;
      if (spec.id === "leprosy") {
        payload.assessment = { ...leprosyAssessment, patches: lepClass?.patches, nerves: lepClass?.nerves };
        payload.scores = scores;
        payload.classification = lepClass?.classification;
      } else {
        payload.assessment = {
          ...payload.assessment,
          secondaryInfection: examRounds.some((r) => r.secondaryInfection === "Yes")
            ? "Yes"
            : examRounds.some((r) => r.secondaryInfection === "No")
              ? "No"
              : payload.assessment?.secondaryInfection,
        };
      }
    }
    saveEncounter({
      id: existing?.id, patientId: p.id, episodeId: resolveEpisodeId({
        existingId: existing?.episodeId,
        disease: spec.id,
        patientEpisodeId: p.episodeId,
        diseaseEncounters: encounters.filter((e) => e.patientId === p.id && e.disease === spec.id),
      }), disease: spec.id,
      facility, worker: user?.name, type: visitType, referral, status: "Complete",
      diagnosis: diagnosis || "",
      treatment: (
        spec.id === "scabies"
          ? scabiesTreatmentSummary(d)
          : spec.id === "yaws"
            ? yawsTreatmentSummary(d)
            : spec.id === "lf"
              ? lfTreatmentSummary(d)
              : spec.id === "buruli"
                ? buruliTreatmentSummary(d)
                : spec.id === "leprosy"
                  ? leprosyTreatmentSummary(d)
                  : [...d.topical, ...d.oral].join(" + ")
      ) || "",
      outcome: outcome || "",
      data: payload,
      ...(existing ? {
        editedSections: [...new Set([
          ...(existing.editedSections || []),
          ...changedSectionKeys(existing, { ...existing, data: payload, diagnosis, outcome }),
        ])],
      } : {}),
    });
    const savedForm = { ...d, diagnosis: diagnosis || "", outcome: outcome || "", scores };
    setD((s) => ({ ...s, diagnosis: savedForm.diagnosis, outcome: savedForm.outcome, scores: savedForm.scores }));
    markSaved(savedForm);
    setSavedAt(new Date().toLocaleTimeString());
    if (close) navigate(recordPath());
    if (online) toast.success(close ? "Encounter saved" : "Saved to device");
    else toast.success(close ? "Encounter saved · queued until you are online" : "Saved to device · queued until you are online");
  };

  const discardEncounter = () => {
    setD(applyLoadedEncounter(cloneData(empty), spec.id));
    setSavedAt("");
    setCancelOpen(false);
    toast.success("Encounter cancelled");
    navigate(recordPath());
  };

  const requestLeave = () => {
    if (dirty) {
      setCancelOpen(true);
      return;
    }
    navigate(recordPath());
  };

  const openLeprosyExam = (occasion) => {
    setD((s) => {
      const current = normalizeExamRounds(s, spec);
      const next = [emptyExamRound(occasion), ...current];
      return {
        ...s,
        examRounds: next,
        assessment: next[0]?.assessment || s.assessment,
        marks: next.reduce((acc, r) => ({ ...acc, ...(r.marks || {}) }), {}),
      };
    });
    setExamFocus({ round: 0, key: Date.now() });
    setOpen((o) => ({ ...o, 3: true }));
    requestAnimationFrame(() => {
      document.querySelector('[data-testid="section-3"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    toast.message(`Opened ${occasion} assessment`);
  };

  const sections = [
    { n: 1, title: `Case details`, done: !!d.caseDetails.mode, body: <FormRenderer fields={spec.caseDetails} data={d.caseDetails} onChange={set("caseDetails")} prefix="case" gender={p.gender || p.sex} /> },
    { n: 2, title: `${spec.name} Clinical history`, done: Object.keys(d.history).length > 0, body: <FormRenderer fields={spec.history} data={d.history} onChange={set("history")} prefix="hist" /> },
    { n: 3, title: spec.id === "scabies" ? "Scabies Examination"
      : spec.id === "yaws" ? "Yaws Examination"
      : spec.id === "lf" ? "Lymphatic Filariasis Examination"
      : spec.id === "buruli" ? "Buruli Ulcer Examination"
      : spec.id === "leprosy" ? "Leprosy Examination"
      : "Assessment / body charting",
      done: spec.id === "leprosy"
        ? (examRounds || []).length > 0 && (examRounds || []).every((r, idx, all) =>
          !isMandatoryLepExamRound(r, idx, all) || !leprosyNfaGaps(r.assessment).incomplete)
        : Object.keys(chartMarks).length > 0 || d.photos.length > 0 || Object.keys(d.assessment || {}).length > 0
          || (examRounds || []).some((r) => r.secondaryInfection || Object.keys(r.assessment || {}).length > 0),
      body: (
        <div className="space-y-6">
          {spec.repeatExam ? (
            <RepeatableBodyExam
              spec={spec}
              value={examRounds}
              encounterDate={existing?.date || localISODate()}
              highlightNfa={Boolean(nfaGate)}
              focusRound={examFocus.round ?? nfaGate?.round}
              focusKey={examFocus.key}
              onChange={(rounds) => setD((s) => ({
                ...s,
                examRounds: rounds,
                assessment: rounds[rounds.length - 1]?.assessment || s.assessment,
                marks: rounds.reduce((acc, r) => ({ ...acc, ...(r.marks || {}) }), {}),
              }))}
              sex={p.gender || p.sex}
            />
          ) : (
            <>
              <DiseaseBodyChart spec={spec} marks={d.marks} onChange={set("marks")} sex={p.gender || p.sex} />
              {spec.assessmentExtra.length > 0 && <FormRenderer fields={spec.assessmentExtra} data={d.assessment} onChange={set("assessment")} prefix="assess" />}
            </>
          )}
          {spec.id === "leprosy" && lepClass && (Object.keys(chartMarks).length > 0 || Object.keys(leprosyAssessment).length > 0) && scores && (
            <LeprosyExamSummary
              classification={lepClass.classification}
              scores={scores}
            />
          )}
          <PhotoCapture label="Assessment photographs" photos={d.photos} onChange={set("photos")} testid="encounter-photo" />
        </div>
      ) },
    { n: 4, title: "Laboratory", done: Object.keys(d.lab).length > 0, body: <FormRenderer fields={spec.lab} data={d.lab} onChange={set("lab")} prefix="lab" /> },
    { n: 5, title: "Diagnosis", done: !!diagnosis,
      body: (
        <div className="space-y-4">
          {spec.diagnosisHelp && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Use IACS criteria for accurate classification</p>
              <ScabiesDiagnosisHelp />
            </div>
          )}
          {autoDx && <AlertPanel level="info" title="System-calculated diagnosis" testid="auto-diagnosis">{autoDx} — override below if needed.</AlertPanel>}
          <ChoiceRow
            label="Diagnosis"
            options={spec.diagnosis}
            value={d.diagnosis || autoDx}
            onChange={(v) => {
              diagnosisTouchedRef.current = true;
              set("diagnosis")(v);
            }}
            testid="diagnosis"
          />
        </div>
      ) },
    { n: 6, title: "Medications",
      done: d.topical.length + d.oral.length + (d.topicalAntibiotics || []).length + (d.oralAntibiotics || []).length
        + (spec.id === "lf" ? (d.recommendations || []).length : 0) > 0,
      body: (
        <div className="space-y-6">
          {d.history?.allergy === "Yes" && String(d.history?.allergyDetail || "").trim() && (
            <AlertPanel level="review" title="Allergy warning" testid="medication-allergy-warning">
              {String(d.history.allergyDetail).trim()}
            </AlertPanel>
          )}
          <RegimenBanner names={d.regimenNames || []} />
          {spec.id === "scabies" ? (
            <ScabiesMedications
              topical={d.topical}
              oral={d.oral}
              topicalAntibiotics={d.topicalAntibiotics || []}
              oralAntibiotics={d.oralAntibiotics || []}
              ivermectinTabletMg={d.ivermectinTabletMg ?? 3}
              sulphurStrength={d.sulphurStrength || "5%"}
              patient={p}
              caseDetails={d.caseDetails}
              history={d.history}
              weight={weight}
              medCourses={d.medCourses || {}}
              posology={d.posology || {}}
              matchedRegimens={matchedRegimens}
              catalogue={catalogue}
              onChange={(patch) => setD((s) => ({ ...s, ...patch }))}
            />
          ) : spec.id === "yaws" ? (
            <YawsMedications
              oral={d.oral}
              patient={p}
              weight={weight}
              azithromycinTabletMg={d.azithromycinTabletMg ?? 500}
              medCourses={d.medCourses || {}}
              posology={d.posology || {}}
              matchedRegimens={matchedRegimens}
              catalogue={catalogue}
              onChange={(patch) => setD((s) => ({ ...s, ...patch }))}
            />
          ) : spec.id === "lf" ? (
            <LfMedications
              oral={d.oral}
              topical={d.topical}
              recommendations={d.recommendations || []}
              ivermectinTabletMg={d.ivermectinTabletMg ?? 3}
              patient={p}
              history={d.history}
              weight={weight}
              medCourses={d.medCourses || {}}
              posology={d.posology || {}}
              matchedRegimens={matchedRegimens}
              catalogue={catalogue}
              onChange={(patch) => setD((s) => ({ ...s, ...patch }))}
            />
          ) : spec.id === "buruli" ? (
            <BuruliMedications
              oral={d.oral}
              rifampicinTabletMg={d.rifampicinTabletMg ?? 300}
              clarithromycinTabletMg={d.clarithromycinTabletMg ?? 500}
              weight={weight}
              medCourses={d.medCourses || {}}
              posology={d.posology || {}}
              matchedRegimens={matchedRegimens}
              catalogue={catalogue}
              onChange={(patch) => setD((s) => ({ ...s, ...patch }))}
            />
          ) : spec.id === "leprosy" ? (
            <LeprosyMedications
              oral={d.oral}
              patient={p}
              weight={weight}
              reactions={d.reactions || []}
              medCourses={d.medCourses || {}}
              posology={d.posology || {}}
              matchedRegimens={matchedRegimens}
              catalogue={catalogue}
              diagnosis={diagnosis}
              onChange={(patch) => setD((s) => ({ ...s, ...patch }))}
            />
          ) : (
            <>
              {spec.drugs.topical && <CheckGrid label="Topical / supportive" options={spec.drugs.topical} value={d.topical} onChange={set("topical")} testid="topical" cols="sm:grid-cols-2" />}
              <Field label={`Oral / injectable — dose calculated from ${weight || "?"} kg`}>
                <div className="space-y-3">
                  {spec.drugs.oral.map((o) => {
                    const on = d.oral.includes(o.name);
                    const doseText = oralDose(o);
                    return (
                      <div key={o.name} className="space-y-2">
                        <button type="button" data-testid={`oral-${o.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                          onClick={() => setD((s) => {
                            const nextOn = !s.oral.includes(o.name);
                            const oral = nextOn ? [...s.oral, o.name] : s.oral.filter((x) => x !== o.name);
                            return {
                              ...s,
                              oral,
                              medCourses: withDrugCourse(s.medCourses, o.name, nextOn),
                              posology: nextOn ? s.posology : dropVisitPosology(s.posology, o.name),
                            };
                          })}
                          className={`flex min-h-12 w-full items-center gap-3 rounded-md border px-4 text-left text-sm font-semibold ${on ? "border-primary bg-secondary" : "border-border bg-white hover:bg-muted"}`}>
                          <span className={`grid h-6 w-6 place-items-center rounded border ${on ? "border-primary bg-primary text-white" : "border-input"}`}>{on && <Check className="h-4 w-4" />}</span>
                          <span className="flex-1">{o.name}</span>
                          <span className="text-xs font-normal text-muted-foreground">{doseText}</span>
                        </button>
                        {on && (
                          <DrugVisitFields
                            name={o.name}
                            selected
                            medCourses={d.medCourses || {}}
                            posology={d.posology || {}}
                            matchedRegimens={matchedRegimens}
                            catalogue={catalogue}
                            onChange={(patch) => setD((s) => ({ ...s, ...patch }))}
                            defaults={{
                              dosage: doseText === "enter weight" ? "" : doseText,
                              frequency: /BID/i.test(String(o.schedule)) ? "Twice daily" : /\bOD\b/i.test(String(o.schedule)) ? "Once daily" : "",
                              duration: o.schedule || "",
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </Field>
            </>
          )}
          <AddDrugSelect
            catalogue={catalogue}
            diseaseId={spec.id}
            selected={[...d.topical, ...d.oral]}
            onAdd={(name) => setD((s) => ({
              ...s,
              ...addCatalogueDrug({
                name,
                catalogue,
                topical: s.topical,
                oral: s.oral,
                medCourses: s.medCourses,
                posology: s.posology,
                matchedRegimens,
                allRegimens: settings.regimens || [],
              }),
            }))}
          />
          <ExtraSelectedDrugs
            diseaseId={spec.id}
            topical={d.topical}
            oral={d.oral}
            catalogue={catalogue}
            medCourses={d.medCourses || {}}
            posology={d.posology || {}}
            matchedRegimens={matchedRegimens}
            allRegimens={settings.regimens || []}
            onChange={(patch) => setD((s) => ({ ...s, ...patch }))}
          />
          {spec.adherence && (
            <AdherenceGrid
              spec={spec}
              value={d.adherence}
              onChange={set("adherence")}
              startDate={d.caseDetails?.treatmentStart || d.adherence?.lines?.[d.adherence.lines.length - 1]?.startDate}
              diagnosis={diagnosis}
              onRestart={() => set("adherence")({})}
            />
          )}
        </div>
      ) },
    { n: 7, title: "Household Contact Tracing", done: Object.keys(d.household || {}).some((k) => {
      const v = d.household[k];
      if (Array.isArray(v)) return v.length > 0;
      if (v && typeof v === "object") return Object.values(v).some((n) => Number(n) > 0);
      return !!v;
    }), body: <FormRenderer fields={spec.household} data={d.household} onChange={set("household")} prefix="hh" sourcePatient={p} /> },
    ...(spec.id === "leprosy"
      ? [{
          n: 8,
          title: "Leprosy reaction",
          done: (d.reactions || []).some(isReactionFilled),
          body: <LeprosyReaction value={d.reactions || []} onChange={set("reactions")} onStartExam={openLeprosyExam} followUp={lepReactionMode.followUp} allowAdd={lepReactionMode.allowAdd} id="lep-reaction" />,
        }]
      : []),
    { n: spec.id === "leprosy" ? 9 : 8, title: "Visit notes", done: normalizeNotes(d.notes).some((n) => String(n).trim()), body: <VisitNotes value={d.notes} onChange={set("notes")} /> },
    { n: spec.id === "leprosy" ? 10 : 9, title: usesActiveDefault ? "Final case outcome" : "Treatment outcome & recommendation",
      done: usesActiveDefault ? !!outcome : d.outcome !== "Open",
      body: (
        <div className="space-y-5">
          {usesActiveDefault && (
            <p className="text-sm text-muted-foreground">
              Outcome defaults to Active when the episode starts. If diagnosis is {noDiseaseOutcome || "No disease"}, outcome is set to {noDiseaseOutcome || "match"} automatically.
            </p>
          )}
          <ChoiceRow label="Outcome" options={spec.outcomes} value={outcome} onChange={set("outcome")} testid="outcome" />
          {spec.id === "leprosy" && outcome === "Cured" && (
            <div className="rounded-md border border-border bg-secondary/40 p-4">
              <p className="mb-3 text-sm text-muted-foreground">
                Outcome is Cured. Conduct a Leprosy examination (assessment) to confirm disability status and residual findings.
              </p>
              <Button
                type="button"
                className="h-12"
                data-testid="leprosy-cured-exam-btn"
                onClick={() => openLeprosyExam("Upon Completion (RFT)")}
              >
                <Stethoscope className="mr-2 h-4 w-4" /> Conduct Leprosy examination (assessment)
              </Button>
            </div>
          )}
          <CheckGrid label="Recommendation" options={spec.recommendations} value={d.recommendations} onChange={set("recommendations")} testid="recommendation" cols="sm:grid-cols-1" />
        </div>
      ) },
  ];

  const doneCount = sections.filter((s) => s.done).length;
  const recordedOutcome = outcome && outcome !== "Open" ? outcome : "";
  const allExpanded = sections.every((s) => open[s.n] !== false);

  return (
    <AppShell>
      <div className={`grid gap-6 pb-28 ${lhs ? "lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]" : "lg:grid-cols-1"}`}>
        {lhs && (
          <PatientSidebar
            patient={p}
            encounters={patientEncs}
            diseases={myDiseases}
            onCollapse={() => setLhs(false)}
            testid="encounter-lhs-panel"
          />
        )}

        <div className="min-w-0 space-y-4">
          <div className="sticky top-[65px] z-30 -mx-1 mb-0 flex flex-wrap items-center gap-3 bg-background px-1 py-3 lg:top-[69px]">
            {!lhs && (
              <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" data-testid="lhs-expand-btn" onClick={() => setLhs(true)}>
                <PanelLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-head text-xl font-bold tracking-tight sm:text-2xl">{spec.name} encounter</p>
              <p className="text-xs text-muted-foreground" data-testid="encounter-context">
                {facility} · {visitType} · Referral {referral}
              </p>
            </div>
            <button
              type="button"
              data-testid="toggle-all-sections-btn"
              aria-label={allExpanded ? "Unfold less" : "Unfold more"}
              title={allExpanded ? "Collapse all" : "Expand all"}
              onClick={() => setOpen(Object.fromEntries(sections.map((s) => [s.n, !allExpanded])))}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border text-primary hover:bg-secondary"
            >
              {allExpanded ? <UnfoldLessIcon /> : <UnfoldMoreIcon />}
            </button>
            <Button variant="outline" className="h-11 shrink-0" data-testid="exit-encounter-btn" onClick={requestLeave}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Exit to record
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-muted-foreground">Encounter completeness</p>
              <span className="text-sm font-semibold" data-testid="completeness-label">{doneCount} of {sections.length} sections captured</span>
            </div>
            <Progress value={(doneCount / sections.length) * 100} className="mt-3 h-2.5" />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <StatusChips
                diseaseId={spec.id}
                diagnosis={diagnosis}
                outcome={recordedOutcome}
                testid="encounter-status-chips"
              />
              <PendingSyncChip pending={!existing?.synced} testid="encounter-pending-chip" />
            </div>
          </div>

          {alerts.map(([lvl, t, b], i) => <AlertPanel key={i} level={lvl} title={t} testid={`encounter-alert-${lvl}-${i}`}>{b}</AlertPanel>)}

          {sections.map((s) => (
            <section key={s.n} className="rounded-lg border border-border bg-white" data-testid={`section-${s.n}`}>
              <button type="button" data-testid={`section-toggle-${s.n}`} onClick={() => setOpen((o) => ({ ...o, [s.n]: o[s.n] === false }))} className="flex w-full items-center gap-3 px-5 py-4 text-left">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md text-sm font-bold ${s.done ? "bg-green-50 text-green-700" : "bg-secondary text-primary"}`}>
                  {s.done ? <CircleCheck className="h-5 w-5" /> : s.n}
                </span>
                <span className="flex-1">
                  <span className="block font-head text-lg font-semibold tracking-tight">{s.title}</span>
                  <span className="block text-xs text-muted-foreground">{s.done ? "Captured" : "Not started"}</span>
                </span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open[s.n] !== false ? "rotate-180" : ""}`} />
              </button>
              {open[s.n] !== false && <div className="border-t border-border p-5">{s.body}</div>}
            </section>
          ))}
        </div>
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-30 border-t border-border bg-white lg:bottom-0">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 sm:px-6">
          <span className="hidden text-xs text-muted-foreground sm:block" data-testid="saved-indicator">
            {savedAt ? `Last saved: ${savedAt}` : dirty ? "Unsaved changes" : "Draft — not saved yet"}
          </span>
          <div className="ml-auto flex flex-1 gap-3 sm:flex-none">
            <Button variant="outline" className="h-12 flex-1 sm:flex-none sm:px-8" data-testid="cancel-encounter-btn" onClick={requestLeave}>Cancel</Button>
            <Button variant="outline" className="h-12 flex-1 sm:flex-none sm:px-8" data-testid="save-btn" disabled={!dirty || !user?.canEdit} onClick={() => persist(false)}><Save className="mr-2 h-4 w-4" /> Save</Button>
            <Button className="h-12 flex-1 text-base sm:flex-none sm:px-8" data-testid="save-close-btn" disabled={!dirty || !user?.canEdit} onClick={() => persist(true)}><Check className="mr-2 h-4 w-4" /> Save &amp; close</Button>
          </div>
        </div>
      </div>
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md" data-testid="cancel-encounter-dialog">
          <DialogHeader>
            <DialogTitle>Cancel this encounter?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will discard unsaved entries on this visit and return to the patient record. Already saved records are not deleted.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" data-testid="cancel-encounter-keep" onClick={() => setCancelOpen(false)}>
              Keep editing
            </Button>
            <Button type="button" data-testid="cancel-encounter-confirm" onClick={discardEncounter}>
              Discard and leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
