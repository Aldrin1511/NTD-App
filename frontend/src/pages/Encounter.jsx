import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import PatientSidebar from "@/components/PatientSidebar";
import StatusChips from "@/components/StatusChips";
import { FormRenderer, DiseaseBodyChart, AdherenceGrid } from "@/components/FormRenderer";
import { AreaField, ChoiceRow, CheckGrid, AlertPanel, Field } from "@/components/Fields";
import { PhotoCapture } from "@/components/Capture";
import { DISEASE_SPECS, SPEC_LIST, leprosyScores, leprosyClass, yawsClass } from "@/mock/specs";
import { toast } from "sonner";
import { ArrowLeft, Check, Save, ChevronDown, CircleCheck, PanelLeft } from "lucide-react";

const empty = { caseDetails: {}, history: {}, marks: {}, assessment: {}, photos: [], lab: {}, diagnosis: "", topical: [], oral: [], adherence: {}, household: {}, notes: "", outcome: "Open", recommendations: [] };

export default function Encounter() {
  const { id, diseaseId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { patients, encounters, saveEncounter, user, addDisease } = useStore();
  const p = patients.find((x) => x.id === id);
  const existing = encounters.find((e) => e.id === params.get("enc"));
  const spec = DISEASE_SPECS[existing?.disease || diseaseId] || DISEASE_SPECS.scabies;
  const patientEncs = useMemo(() => encounters.filter((e) => e.patientId === id), [encounters, id]);
  const myDiseases = SPEC_LIST.filter((s) => (p?.diseases || []).includes(s.id));

  const [d, setD] = useState({ ...empty, ...(existing?.data || {}) });
  const [open, setOpen] = useState({ 1: true });
  const [lhs, setLhs] = useState(true);
  const [savedAt, setSavedAt] = useState(existing ? "loaded from record" : "");
  const facility = existing?.facility || params.get("fac") || p?.facility || "";
  const visitType = existing?.type || params.get("vt") || "Encounter";
  const referral = params.get("ref") || existing?.referral || "No";
  const set = (k) => (v) => setD((s) => ({ ...s, [k]: v }));

  const weight = Number(d.caseDetails?.weight || p?.weight || 0);
  const scores = spec.id === "leprosy" ? leprosyScores(d.assessment) : null;
  const autoDx = spec.id === "leprosy" ? leprosyClass({ ...d.assessment, ...d.lab }) : spec.id === "yaws" ? yawsClass(d.marks) : "";

  const alerts = useMemo(() => {
    const a = [];
    const codes = Object.values(d.marks).map((m) => m.code);
    if (spec.id === "scabies" && codes.includes("C")) a.push(["urgent", "🔴 Crusted skin recorded", "Consider crusted scabies — urgent clinician review and intensified treatment."]);
    if (spec.id === "buruli" && Object.values(d.marks).some((m) => m.extra === "Category 3")) a.push(["urgent", "🔴 Category 3 lesion", "Refer for surgical assessment alongside antibiotic therapy."]);
    if (spec.id === "leprosy" && scores?.g2d === 2) a.push(["urgent", "🔴 WHO Grade 2 disability", `EHF score ${scores.ehf} — refer for MMDP and self-care.`]);
    if (spec.id === "lf" && Object.values(d.marks).some((m) => m.extra === "Acute")) a.push(["review", "🟠 Acute secondary infection", "Treat the acute attack and start limb hygiene / self-care."]);
    if (d.assessment?.secondaryInfection === "Yes") a.push(["review", "🟠 Secondary infection", "Add antibiotic cover per protocol."]);
    if (String(d.diagnosis).startsWith("No ")) a.push(["routine", "🟢 NTD not confirmed", "Outcome set to match the diagnosis."]);
    if (!a.length) a.push(["routine", "🟢 Routine", "No urgent flags from the data captured so far."]);
    return a;
  }, [d, spec, scores]);

  if (!p) return <AppShell title="Patient not found"><Button className="h-12" onClick={() => navigate("/patients")}>Back</Button></AppShell>;

  const oralDose = (o) => {
    if (o.fixed) return o.fixed;
    if (!o.mgPerKg || !weight) return "enter weight";
    const mg = weight * o.mgPerKg;
    return `${mg.toFixed(1)} mg${o.tablet ? ` · ${(Math.round((mg / o.tablet) * 2) / 2)} tab(s) of ${o.tablet}mg` : ""}`;
  };

  const diagnosis = d.diagnosis || autoDx;
  const outcome = String(diagnosis).startsWith("No ") ? spec.outcomes.find((o) => o.startsWith("No ")) || d.outcome : d.outcome;

  const persist = (close) => {
    addDisease(p.id, spec.id);
    saveEncounter({
      id: existing?.id, patientId: p.id, episodeId: existing?.episodeId || p.episodeId, disease: spec.id,
      facility, worker: user?.name, type: visitType, referral, status: "Complete",
      diagnosis: diagnosis || "—", treatment: [...d.topical, ...d.oral].join(" + ") || "—", outcome,
      data: { ...d, diagnosis, outcome, scores },
    });
    setSavedAt(new Date().toLocaleTimeString());
    if (close) { toast.success("Encounter saved · queued for cloud sync"); navigate(`/patients/${p.id}`); }
    else toast.success("Saved to device");
  };

  const sections = [
    { n: 1, title: `${spec.name} case details`, done: !!d.caseDetails.mode, body: <FormRenderer fields={spec.caseDetails} data={d.caseDetails} onChange={set("caseDetails")} prefix="case" /> },
    { n: 2, title: "Clinical history", done: Object.keys(d.history).length > 0, body: <FormRenderer fields={spec.history} data={d.history} onChange={set("history")} prefix="hist" /> },
    { n: 3, title: "Assessment / body charting", done: Object.keys(d.marks).length > 0 || d.photos.length > 0,
      body: (
        <div className="space-y-6">
          <DiseaseBodyChart spec={spec} marks={d.marks} onChange={set("marks")} sex={p.sex} />
          {spec.assessmentExtra.length > 0 && <FormRenderer fields={spec.assessmentExtra} data={d.assessment} onChange={set("assessment")} prefix="assess" />}
          {scores && (
            <div className="grid gap-3 sm:grid-cols-3" data-testid="leprosy-scores">
              {[["EHF score (max 12)", scores.ehf], ["WHO G2D grade", scores.g2d], ["Eyes / Hands / Feet", `${scores.eyes} / ${scores.hands} / ${scores.feet}`]].map(([k, v]) => (
                <div key={k} className="rounded-md border border-border p-3"><p className="text-xs uppercase tracking-wider text-muted-foreground">{k}</p><p className="mt-1 font-head text-2xl font-bold">{v}</p></div>
              ))}
            </div>
          )}
          <PhotoCapture label="Assessment photographs" photos={d.photos} onChange={set("photos")} testid="encounter-photo" />
        </div>
      ) },
    { n: 4, title: "Laboratory", done: Object.keys(d.lab).length > 0, body: <FormRenderer fields={spec.lab} data={d.lab} onChange={set("lab")} prefix="lab" /> },
    { n: 5, title: "Diagnosis", done: !!diagnosis,
      body: (
        <div className="space-y-4">
          {autoDx && <AlertPanel level="info" title="System-calculated diagnosis" testid="auto-diagnosis">{autoDx} — override below if needed.</AlertPanel>}
          <ChoiceRow label="Diagnosis" options={spec.diagnosis} value={d.diagnosis} onChange={set("diagnosis")} testid="diagnosis" />
        </div>
      ) },
    { n: 6, title: "Drugs / treatment", done: d.topical.length + d.oral.length > 0,
      body: (
        <div className="space-y-6">
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
          {spec.adherence && <AdherenceGrid spec={spec} value={d.adherence} onChange={set("adherence")} startDate={d.caseDetails?.treatmentStart} onRestart={() => set("adherence")({})} />}
        </div>
      ) },
    { n: 7, title: "Household contact tracing", done: (d.household.contacts || []).length > 0, body: <FormRenderer fields={spec.household} data={d.household} onChange={set("household")} prefix="hh" /> },
    { n: 8, title: "Visit notes", done: !!d.notes, body: <AreaField label="Clinical note" rows={8} testid="visit-notes" value={d.notes} onChange={(e) => set("notes")(e.target.value)} /> },
    { n: 9, title: "Treatment outcome & recommendation", done: d.outcome !== "Open",
      body: (
        <div className="space-y-5">
          <ChoiceRow label="Treatment outcome" options={spec.outcomes} value={outcome} onChange={set("outcome")} testid="outcome" />
          <CheckGrid label="Recommendation" options={spec.recommendations} value={d.recommendations} onChange={set("recommendations")} testid="recommendation" cols="sm:grid-cols-2" />
        </div>
      ) },
  ];

  const doneCount = sections.filter((s) => s.done).length;
  const recordedOutcome = outcome && outcome !== "Open" ? outcome : "";

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
            <div className="mt-3">
              <StatusChips
                diseaseId={spec.id}
                diagnosis={diagnosis}
                outcome={recordedOutcome}
                pending={!existing?.synced}
                testid="encounter-status-chips"
              />
            </div>
          </div>

          {alerts.map(([lvl, t, b], i) => <AlertPanel key={i} level={lvl} title={t} testid={`encounter-alert-${lvl}-${i}`}>{b}</AlertPanel>)}

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
