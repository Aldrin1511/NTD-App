import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import PatientSidebar from "@/components/PatientSidebar";
import StatusChips, { PendingSyncChip } from "@/components/StatusChips";
import { FormRenderer, DiseaseBodyChart, AdherenceGrid, RepeatableBodyExam, normalizeExamRounds, LeprosyExamSummary } from "@/components/FormRenderer";
import { AreaField, ChoiceRow, CheckGrid, AlertPanel, Field, ItemActions, withDrugCourse } from "@/components/Fields";
import { PhotoCapture } from "@/components/Capture";
import LeprosyReaction from "@/components/LeprosyReaction";
import ScabiesMedications, { scabiesTreatmentSummary, SCABIES_DRUGS, ageInMonths } from "@/components/ScabiesMedications";
import YawsMedications, { yawsTreatmentSummary } from "@/components/YawsMedications";
import LfMedications, { lfTreatmentSummary } from "@/components/LfMedications";
import BuruliMedications, { buruliTreatmentSummary } from "@/components/BuruliMedications";
import LeprosyMedications, { leprosyTreatmentSummary } from "@/components/LeprosyMedications";
import { DISEASE_SPECS, assessmentSpecs, leprosyScores, leprosyClass, yawsClass, resolveEpisodeId, isEpisodeClosed } from "@/mock/specs";
import { changedSectionKeys } from "@/sectionDiff";
import { applyMatchingRegimens, matchingRegimens, formatDosePhysical } from "@/lib/medications";
import { RegimenBanner, AddDrugSelect, ExtraSelectedDrugs, addCatalogueDrug } from "@/components/MedicationShared";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Check, Save, ChevronDown, CircleCheck, PanelLeft, ChevronsDownUp, ChevronsUpDown, CircleHelp, Stethoscope } from "lucide-react";

const empty = {
  caseDetails: {}, history: {}, marks: {}, assessment: {}, examRounds: [], photos: [], lab: {}, diagnosis: "",
  topical: [], oral: [], topicalAntibiotics: [], oralAntibiotics: [], ivermectinTabletMg: 3, sulphurStrength: "5%",
  azithromycinTabletMg: 500,
  rifampicinTabletMg: 300, clarithromycinTabletMg: 500,
  adherence: {}, household: {}, reactions: [], notes: [""], outcome: "Open", recommendations: [],
  medCourses: {},
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
  const addAfter = (i) => {
    const next = [...entries];
    next.splice(i + 1, 0, "");
    onChange(next);
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
              Clinical note {i + 1}
            </p>
            <ItemActions
              onAdd={() => addAfter(i)}
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
  const latest = (encounters || [])
    .filter((e) => e.patientId === patientId && e.disease === disease)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  if (!latest) return null;
  if (isEpisodeClosed(latest.outcome || latest.data?.outcome)) return null;
  return latest;
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
  const hasPriorMeds = (cloned.topical || []).length || (cloned.oral || []).length || cloned.regimenAppliedKey;
  base.regimenAppliedKey = cloned.regimenAppliedKey || (hasPriorMeds ? "loaded" : "");
  base.regimenNames = Array.isArray(cloned.regimenNames) ? cloned.regimenNames : [];
  base.regimenIds = Array.isArray(cloned.regimenIds) ? cloned.regimenIds : [];
  const spec = DISEASE_SPECS[disease];
  if (spec?.repeatExam || base.examRounds?.length) {
    base.examRounds = normalizeExamRounds(base);
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
  const myDiseases = useMemo(() => {
    const fromScreening = assessmentSpecs(id, { suspects, encounters: patientEncs });
    if (fromScreening.some((d) => d.id === spec.id)) return fromScreening;
    return spec.id ? [spec, ...fromScreening] : fromScreening;
  }, [id, suspects, patientEncs, spec]);

  const [d, setD] = useState(() => {
    const disease = existing?.disease || diseaseId;
    const prior = !existing ? latestOpenEncounter(encounters, id, disease) : null;
    const source = existing?.data || (prior ? prior.data : {});
    const loaded = applyLoadedEncounter(source, disease);
    const fromEnc = existing?.diagnosis || prior?.diagnosis || "";
    if (!loaded.diagnosis && fromEnc) {
      loaded.diagnosis = fromEnc === "Clinical scabies" ? "Confirmed Scabies" : fromEnc;
    }
    return loaded;
  });
  const requestedSection = Number(params.get("section")) || 0;
  const [open, setOpen] = useState(() => (requestedSection ? { [requestedSection]: true } : { 1: true }));
  const [lhs, setLhs] = useState(true);
  const [savedAt, setSavedAt] = useState(existing ? "loaded from record" : "");
  const facility = existing?.facility || params.get("fac") || p?.facility || "";
  const visitType = existing?.type || params.get("vt") || "Encounter";
  const referral = params.get("ref") || existing?.referral || "No";
  const set = (k) => (v) => setD((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!requestedSection) return undefined;
    const timer = window.setTimeout(() => {
      document.querySelector(`[data-testid="section-${requestedSection}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [requestedSection]);

  useEffect(() => {
    if (spec.id !== "scabies") return;
    if (d.history?.itching) return;
    const fromSuspect = suspects
      .filter((s) => s.patientId === id)
      .some((s) => hasItchingComplaint(s.symptoms));
    if (fromSuspect) {
      setD((prev) => ({ ...prev, history: { ...prev.history, itching: "Yes" } }));
    }
  }, [spec.id, id, suspects, d.history?.itching]);

  const weight = Number(d.caseDetails?.weight || p?.weight || 0);
  const examRounds = spec.repeatExam ? normalizeExamRounds(d) : null;
  const chartMarks = examRounds
    ? examRounds.reduce((acc, r) => ({ ...acc, ...(r.marks || {}) }), {})
    : (d.marks || {});
  const leprosyAssessment = (() => {
    if (spec.id !== "leprosy") return d.assessment || {};
    const latest = examRounds?.[examRounds.length - 1];
    return { ...(latest?.assessment || d.assessment || {}), marks: latest?.marks || chartMarks };
  })();
  const lepClass = spec.id === "leprosy" ? leprosyClass({ ...leprosyAssessment, ...d.lab, marks: chartMarks }) : null;
  const scores = spec.id === "leprosy" ? leprosyScores({ ...leprosyAssessment, marks: chartMarks }) : null;
  const autoDx = spec.id === "leprosy"
    ? (lepClass?.classification || "")
    : spec.id === "yaws"
      ? yawsClass(chartMarks)
      : "";
  const diagnosis = d.diagnosis || autoDx;
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
    const codes = Object.values(chartMarks).map((m) => m.code);
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

  if (!p) return <AppShell title="Patient not found"><Button className="h-12" onClick={() => navigate("/patients")}>Back</Button></AppShell>;

  const oralDose = (o) => {
    if (o.fixed) return o.fixed;
    if (!o.mgPerKg || !weight) return "enter weight";
    const mg = weight * o.mgPerKg;
    return `${formatDosePhysical(mg, o.tablet ? Math.round((mg / o.tablet) * 2) / 2 : null)}`;
  };

  const persist = (close) => {
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
    setSavedAt(new Date().toLocaleTimeString());
    if (close) navigate(`/patients/${p.id}`);
    if (online) toast.success(close ? "Encounter saved" : "Saved to device");
    else toast.success(close ? "Encounter saved · queued until you are online" : "Saved to device · queued until you are online");
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
      done: Object.keys(chartMarks).length > 0 || d.photos.length > 0 || Object.keys(d.assessment || {}).length > 0
        || (examRounds || []).some((r) => r.secondaryInfection || Object.keys(r.assessment || {}).length > 0),
      body: (
        <div className="space-y-6">
          {spec.repeatExam ? (
            <RepeatableBodyExam
              spec={spec}
              value={examRounds}
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
              patches={lepClass.patches}
              nerves={lepClass.nerves}
              scores={scores}
              onAccept={(cls) => set("diagnosis")(cls)}
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
          <ChoiceRow label="Diagnosis" options={spec.diagnosis} value={d.diagnosis} onChange={set("diagnosis")} testid="diagnosis" />
        </div>
      ) },
    { n: 6, title: "Medications",
      done: d.topical.length + d.oral.length + (d.topicalAntibiotics || []).length + (d.oralAntibiotics || []).length
        + (spec.id === "lf" ? (d.recommendations || []).length : 0) > 0,
      body: (
        <div className="space-y-6">
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
              onChange={(patch) => setD((s) => ({ ...s, ...patch }))}
            />
          ) : spec.id === "yaws" ? (
            <YawsMedications
              oral={d.oral}
              patient={p}
              weight={weight}
              azithromycinTabletMg={d.azithromycinTabletMg ?? 500}
              medCourses={d.medCourses || {}}
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
              onChange={(patch) => setD((s) => ({ ...s, ...patch }))}
            />
          ) : spec.id === "buruli" ? (
            <BuruliMedications
              oral={d.oral}
              rifampicinTabletMg={d.rifampicinTabletMg ?? 300}
              clarithromycinTabletMg={d.clarithromycinTabletMg ?? 500}
              weight={weight}
              medCourses={d.medCourses || {}}
              onChange={(patch) => setD((s) => ({ ...s, ...patch }))}
            />
          ) : spec.id === "leprosy" ? (
            <LeprosyMedications
              oral={d.oral}
              patient={p}
              weight={weight}
              reactions={d.reactions || []}
              medCourses={d.medCourses || {}}
              onChange={(patch) => setD((s) => ({ ...s, ...patch }))}
            />
          ) : (
            <>
              {spec.drugs.topical && <CheckGrid label="Topical / supportive" options={spec.drugs.topical} value={d.topical} onChange={set("topical")} testid="topical" cols="sm:grid-cols-2" />}
              <Field label={`Oral / injectable — dose calculated from ${weight || "?"} kg`}>
                <div className="space-y-2">
                  {spec.drugs.oral.map((o) => {
                    const on = d.oral.includes(o.name);
                    return (
                      <button key={o.name} type="button" data-testid={`oral-${o.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                        onClick={() => set("oral")(on ? d.oral.filter((x) => x !== o.name) : [...d.oral, o.name])}
                        className={`flex min-h-12 w-full items-center gap-3 rounded-md border px-4 text-left text-sm font-semibold ${on ? "border-primary bg-secondary" : "border-border bg-white hover:bg-muted"}`}>
                        <span className={`grid h-6 w-6 place-items-center rounded border ${on ? "border-primary bg-primary text-white" : "border-input"}`}>{on && <Check className="h-4 w-4" />}</span>
                        <span className="flex-1">{o.name}</span>
                        <span className="text-xs font-normal text-muted-foreground">{oralDose(o)}</span>
                      </button>
                    );
                  })}
                </div>
              </Field>
            </>
          )}
          <ExtraSelectedDrugs
            diseaseId={spec.id}
            topical={d.topical}
            oral={d.oral}
            catalogue={settings.drugs || []}
            medCourses={d.medCourses || {}}
            onChange={(patch) => setD((s) => ({ ...s, ...patch }))}
          />
          <AddDrugSelect
            catalogue={settings.drugs || []}
            diseaseId={spec.id}
            selected={[...d.topical, ...d.oral]}
            onAdd={(name) => setD((s) => ({
              ...s,
              ...addCatalogueDrug({
                name,
                catalogue: settings.drugs || [],
                topical: s.topical,
                oral: s.oral,
                medCourses: s.medCourses,
              }),
            }))}
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
          done: (d.reactions || []).length > 0,
          body: <LeprosyReaction value={d.reactions || []} onChange={set("reactions")} id="lep-reaction" />,
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
                onClick={() => {
                  setOpen((o) => ({ ...o, 3: true }));
                  requestAnimationFrame(() => {
                    document.querySelector('[data-testid="section-3"]')?.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                  toast.message("Opened Assessment / body charting for Leprosy examination");
                }}
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
  const allExpanded = sections.every((s) => open[s.n]);

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
          <div className="flex flex-wrap items-center gap-3">
            {!lhs && (
              <Button variant="outline" size="icon" className="h-11 w-11" data-testid="lhs-expand-btn" onClick={() => setLhs(true)}>
                <PanelLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-head text-xl font-bold tracking-tight sm:text-2xl">{spec.name} encounter</p>
              <p className="text-xs text-muted-foreground" data-testid="encounter-context">
                {facility} · {visitType} · Referral {referral}
              </p>
            </div>
            <Button variant="outline" className="h-11" data-testid="exit-encounter-btn" onClick={() => navigate(`/patients/${p.id}`)}>
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

          <div className="flex justify-end">
            <Button
              variant="outline"
              className="h-11"
              data-testid="toggle-all-sections-btn"
              onClick={() =>
                setOpen(Object.fromEntries(sections.map((s) => [s.n, !allExpanded])))
              }
            >
              {allExpanded ? (
                <>
                  <ChevronsDownUp className="mr-2 h-4 w-4" /> Collapse all
                </>
              ) : (
                <>
                  <ChevronsUpDown className="mr-2 h-4 w-4" /> Expand all
                </>
              )}
            </Button>
          </div>

          {sections.map((s) => (
            <section key={s.n} className="rounded-lg border border-border bg-white" data-testid={`section-${s.n}`}>
              <button type="button" data-testid={`section-toggle-${s.n}`} onClick={() => setOpen((o) => ({ ...o, [s.n]: !o[s.n] }))} className="flex w-full items-center gap-3 px-5 py-4 text-left">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md text-sm font-bold ${s.done ? "bg-green-50 text-green-700" : "bg-secondary text-primary"}`}>
                  {s.done ? <CircleCheck className="h-5 w-5" /> : s.n}
                </span>
                <span className="flex-1">
                  <span className="block font-head text-lg font-semibold tracking-tight">{s.title}</span>
                  <span className="block text-xs text-muted-foreground">{s.done ? "Captured" : "Not started"}</span>
                </span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open[s.n] ? "rotate-180" : ""}`} />
              </button>
              {open[s.n] && <div className="border-t border-border p-5">{s.body}</div>}
            </section>
          ))}
        </div>
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-30 border-t border-border bg-white lg:bottom-0">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 sm:px-6">
          <span className="hidden text-xs text-muted-foreground sm:block" data-testid="saved-indicator">{savedAt ? `Last saved: ${savedAt}` : "Draft — not saved yet"}</span>
          <div className="ml-auto flex flex-1 gap-3 sm:flex-none">
            <Button variant="outline" className="h-12 flex-1 sm:flex-none sm:px-8" data-testid="save-btn" onClick={() => persist(false)}><Save className="mr-2 h-4 w-4" /> Save</Button>
            <Button className="h-12 flex-1 text-base sm:flex-none sm:px-8" data-testid="save-close-btn" onClick={() => persist(true)}><Check className="mr-2 h-4 w-4" /> Save &amp; close</Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
