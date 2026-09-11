import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import PatientSidebar from "@/components/PatientSidebar";
import StatusChips, { PendingSyncChip } from "@/components/StatusChips";
import { FormRenderer, DiseaseBodyChart, AdherenceGrid, RepeatableBodyExam, normalizeExamRounds, LeprosyExamSummary } from "@/components/FormRenderer";
import { AreaField, ChoiceRow, CheckGrid, AlertPanel, Field } from "@/components/Fields";
import { PhotoCapture } from "@/components/Capture";
import LeprosyReaction from "@/components/LeprosyReaction";
import ScabiesMedications, { scabiesTreatmentSummary } from "@/components/ScabiesMedications";
import { DISEASE_SPECS, SPEC_LIST, leprosyScores, leprosyClass, yawsClass } from "@/mock/specs";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Check, Save, ChevronDown, CircleCheck, PanelLeft, ChevronsDownUp, ChevronsUpDown, CircleHelp, Stethoscope, Plus, Trash2 } from "lucide-react";

const empty = {
  caseDetails: {}, history: {}, marks: {}, assessment: {}, examRounds: [], photos: [], lab: {}, diagnosis: "",
  topical: [], oral: [], topicalAntibiotics: [], oralAntibiotics: [], ivermectinTabletMg: 3, sulphurStrength: "5%",
  adherence: {}, household: {}, reactions: [], notes: [""], outcome: "Open", recommendations: [],
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
  const add = () => onChange([...entries, ""]);
  const remove = (i) => {
    if (entries.length <= 1) return onChange([""]);
    onChange(entries.filter((_, j) => j !== i));
  };

  return (
    <div className="space-y-4" data-testid="visit-notes">
      {entries.map((note, i) => (
        <div key={i} className="rounded-md border border-border bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Clinical note {i + 1}
            </p>
            {entries.length > 1 && (
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-600" data-testid={`visit-notes-remove-${i}`} onClick={() => remove(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
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
      <Button type="button" variant="outline" className="h-12" data-testid="visit-notes-add" onClick={add}>
        <Plus className="mr-2 h-4 w-4" /> Add note
      </Button>
    </div>
  );
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
  const { patients, encounters, suspects, saveEncounter, user, addDisease } = useStore();
  const p = patients.find((x) => x.id === id);
  const existing = encounters.find((e) => e.id === params.get("enc"));
  const spec = DISEASE_SPECS[existing?.disease || diseaseId] || DISEASE_SPECS.scabies;
  const patientEncs = useMemo(() => encounters.filter((e) => e.patientId === id), [encounters, id]);
  const myDiseases = SPEC_LIST.filter((s) => (p?.diseases || []).includes(s.id));

  const [d, setD] = useState(() => {
    const base = { ...empty, ...(existing?.data || {}) };
    base.notes = normalizeNotes(base.notes);
    if ((existing?.disease || diseaseId) === "yaws" || (existing?.disease || diseaseId) === "lf" || (existing?.disease || diseaseId) === "buruli" || (existing?.disease || diseaseId) === "leprosy" || base.examRounds?.length) {
      base.examRounds = normalizeExamRounds(base);
      if ((existing?.disease || diseaseId) === "leprosy" && !base.examRounds[0]?.assessment && base.assessment) {
        base.examRounds = [{ ...base.examRounds[0], assessment: base.assessment, marks: base.marks || base.examRounds[0].marks }];
      }
    }
    const disease = existing?.disease || diseaseId;
    if ((disease === "scabies" || disease === "yaws" || disease === "lf" || disease === "buruli" || disease === "leprosy") && (!base.outcome || base.outcome === "Open")) {
      base.outcome = "Active";
    }
    return base;
  });
  const [open, setOpen] = useState({ 1: true });
  const [lhs, setLhs] = useState(true);
  const [savedAt, setSavedAt] = useState(existing ? "loaded from record" : "");
  const facility = existing?.facility || params.get("fac") || p?.facility || "";
  const visitType = existing?.type || params.get("vt") || "Encounter";
  const referral = params.get("ref") || existing?.referral || "No";
  const set = (k) => (v) => setD((s) => ({ ...s, [k]: v }));

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

  if (!p) return <AppShell title="Patient not found"><Button className="h-12" onClick={() => navigate("/patients")}>Back</Button></AppShell>;

  const oralDose = (o) => {
    if (o.fixed) return o.fixed;
    if (!o.mgPerKg || !weight) return "enter weight";
    const mg = weight * o.mgPerKg;
    return `${mg.toFixed(1)} mg${o.tablet ? ` · ${(Math.round((mg / o.tablet) * 2) / 2)} tab(s) of ${o.tablet}mg` : ""}`;
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
      id: existing?.id, patientId: p.id, episodeId: existing?.episodeId || p.episodeId, disease: spec.id,
      facility, worker: user?.name, type: visitType, referral, status: "Complete",
      diagnosis: diagnosis || "",
      treatment: (spec.id === "scabies" ? scabiesTreatmentSummary(d) : [...d.topical, ...d.oral].join(" + ")) || "",
      outcome: outcome || "",
      data: payload,
    });
    setSavedAt(new Date().toLocaleTimeString());
    if (close) { toast.success("Encounter saved · queued for cloud sync"); navigate(`/patients/${p.id}`); }
    else toast.success("Saved to device");
  };

  const sections = [
    { n: 1, title: `${spec.name} case details`, done: !!d.caseDetails.mode, body: <FormRenderer fields={spec.caseDetails} data={d.caseDetails} onChange={set("caseDetails")} prefix="case" gender={p.gender || p.sex} /> },
    { n: 2, title: "Clinical history", done: Object.keys(d.history).length > 0, body: <FormRenderer fields={spec.history} data={d.history} onChange={set("history")} prefix="hist" /> },
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
    { n: 6, title: "Medications / drugs",
      done: d.topical.length + d.oral.length + (d.topicalAntibiotics || []).length + (d.oralAntibiotics || []).length > 0,
      body: (
        <div className="space-y-6">
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
          {spec.adherence && <AdherenceGrid spec={spec} value={d.adherence} onChange={set("adherence")} startDate={d.caseDetails?.treatmentStart} onRestart={() => set("adherence")({})} />}
        </div>
      ) },
    { n: 7, title: "Household contact tracing", done: Object.keys(d.household || {}).some((k) => {
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
              <p className="text-xs uppercase tracking-wider text-muted-foreground" data-testid="encounter-context">
                {facility} · {visitType} · Referral {referral}
              </p>
            </div>
            <Button variant="outline" className="h-11" data-testid="exit-encounter-btn" onClick={() => navigate(`/patients/${p.id}`)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Exit to record
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Encounter completeness</p>
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
                  <span className="block text-xs uppercase tracking-wider text-muted-foreground">{s.done ? "Captured" : "Not started"}</span>
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
