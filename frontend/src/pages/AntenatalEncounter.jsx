import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import PatientSidebar from "@/components/PatientSidebar";
import { Field, TextField, AreaField, SelectField, ChoiceRow, CheckGrid, AlertPanel, ItemActions } from "@/components/Fields";
import { localISODate, fmtDate } from "@/mock/specs";
import {
  ANTENATAL_ID, ANTENATAL_NAME, ANC_HISTORY_FIELDS, MOTHER_VITALS, MOTHER_VITAL_CHOICES,
  FETAL_VITALS, FETAL_VITAL_CHOICES, vitalStatus, ANC_LAB_TESTS, RADIOLOGY_SCANS, ANC_DRUGS,
  ANC_IMMUNIZATION, immunizationDueDate, isImmunizationOverdue, DELIVERY_MODES, DELIVERY_PLACES,
  BABY_OUTCOMES, BABY_SEX, ANC_OUTCOMES, resolveDating, trimesterLabel, newAncEpisodeId,
  isAncEpisodeClosed, babyName,
} from "@/mock/antenatal";
import { GEO } from "@/mock/data";
import { toast } from "sonner";
import { ArrowLeft, Check, Save, ChevronDown, CircleCheck, PanelLeft, Plus, Trash2, Baby, Search } from "lucide-react";

const empty = () => ({
  caseDetails: {},
  history: {},
  vitals: { mother: {}, fetal: {} },
  lab: [],
  radiology: [],
  drugs: [],
  immunization: {},
  notes: [""],
  delivery: { babies: [] },
  outcome: { status: "" },
});

const statusRing = { green: "border-green-500", amber: "border-amber-500", red: "border-red-500", "": "border-border" };
const statusText = { green: "text-green-700", amber: "text-amber-700", red: "text-red-700", "": "text-foreground" };

const SliderStat = ({ field, value, onChange, testid }) => {
  const has = value !== undefined && value !== "" && value !== null;
  const st = has ? vitalStatus(field, value) : "";
  const cur = has ? Number(value) : (field.normal ? Math.round((field.normal[0] + field.normal[1]) / 2) : Math.round((field.min + field.max) / 2));
  return (
    <div className={`rounded-md border ${statusRing[st]} bg-white p-3`} data-testid={testid}>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{field.label}</span>
        <span className={`text-lg font-bold tabular-nums ${statusText[st]}`}>
          {has ? value : "—"}<span className="ml-1 text-xs font-medium text-muted-foreground">{field.unit}</span>
        </span>
      </div>
      <Slider
        className="mt-3"
        min={field.min}
        max={field.max}
        step={field.step}
        value={[cur]}
        onValueChange={([v]) => onChange(field.step < 1 ? Math.round(v * 10) / 10 : Math.round(v))}
        data-testid={`${testid}-slider`}
      />
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{field.min}</span>
        {field.normal && <span>normal {field.normal[0]}–{field.normal[1]}</span>}
        <span>{field.max}</span>
      </div>
    </div>
  );
};

const ChoiceChips = ({ label, options, value, onChange, testid }) => (
  <Field label={label}>
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o;
        return (
          <button
            key={o}
            type="button"
            data-testid={`${testid}-${o.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            onClick={() => onChange(on ? "" : o)}
            className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${on ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-muted"}`}
          >
            {o}
          </button>
        );
      })}
    </div>
  </Field>
);

const MiniFieldRenderer = ({ fields, data, onChange, prefix }) => (
  <div className="grid gap-4 sm:grid-cols-2">
    {fields.map((f) => {
      const set = (v) => onChange({ ...data, [f.k]: v });
      const val = data[f.k];
      if (f.type === "choice") return <SelectField key={f.k} label={f.label} options={f.options} value={val || ""} onChange={set} testid={`${prefix}-${f.k}`} />;
      if (f.type === "checks")
        return (
          <div key={f.k} className="sm:col-span-2">
            <CheckGrid label={f.label} options={f.options} value={val || []} onChange={set} testid={`${prefix}-${f.k}`} />
          </div>
        );
      if (f.type === "textarea")
        return (
          <div key={f.k} className="sm:col-span-2">
            <AreaField label={f.label} rows={3} testid={`${prefix}-${f.k}`} value={val || ""} onChange={(e) => set(e.target.value)} />
          </div>
        );
      return (
        <TextField key={f.k} label={f.label} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} testid={`${prefix}-${f.k}`} value={val || ""} onChange={(e) => set(e.target.value)} />
      );
    })}
  </div>
);

export default function AntenatalEncounter() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { patients, encounters, saveEncounter, user, settings, facilities, registerBaby, online } = useStore();
  const p = patients.find((x) => x.id === id);
  const existing = encounters.find((e) => e.id === params.get("enc") && e.disease === ANTENATAL_ID);
  const patientEncs = useMemo(() => encounters.filter((e) => e.patientId === id), [encounters, id]);

  const [d, setD] = useState(() => ({ ...empty(), ...(existing?.data || {}) }));
  const [open, setOpen] = useState({});
  const [savedAt, setSavedAt] = useState(existing ? "loaded from record" : "");
  const [labSearch, setLabSearch] = useState("");
  const facility = existing?.facility || params.get("fac") || p?.facility || "";
  const visitType = existing?.type || params.get("vt") || "ANC visit";

  const dating = useMemo(() => resolveDating(d.caseDetails), [d.caseDetails]);
  const facilityHasLab = useMemo(() => facilities.some((f) => f.name === facility && f.hasLab), [facilities, facility]);
  const vaccineDrugs = useMemo(() => (settings.drugs || []).filter((x) => x.type === "Vaccine" || x.form === "Vaccine"), [settings.drugs]);
  const firstContact = existing?.date || d.caseDetails?.firstContact || localISODate();

  const setCase = (patch) => setD((s) => ({ ...s, caseDetails: { ...s.caseDetails, ...patch } }));
  const setMotherV = (k, v) => setD((s) => ({ ...s, vitals: { ...s.vitals, mother: { ...s.vitals.mother, [k]: v } } }));
  const setFetalV = (k, v) => setD((s) => ({ ...s, vitals: { ...s.vitals, fetal: { ...s.vitals.fetal, [k]: v } } }));

  if (!p) return <AppShell title="Patient not found"><Button className="h-12" onClick={() => navigate("/patients")}>Back</Button></AppShell>;

  // ---- Lab helpers ----
  const addLab = (name) => {
    setD((s) => ({ ...s, lab: [{ test: name, result: "", location: facilityHasLab ? "Lab" : "Bedside", date: localISODate(), sentToLab: false }, ...s.lab] }));
    setLabSearch("");
  };
  const updLab = (i, patch) => setD((s) => ({ ...s, lab: s.lab.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const rmLab = (i) => setD((s) => ({ ...s, lab: s.lab.filter((_, j) => j !== i) }));
  const labMatches = ANC_LAB_TESTS.filter((t) => t.name.toLowerCase().includes(labSearch.toLowerCase()) && !d.lab.some((x) => x.test === t.name));

  // ---- Radiology ----
  const addRadiology = () => setD((s) => ({ ...s, radiology: [{ scan: "", findings: "", date: localISODate() }, ...s.radiology] }));
  const updRad = (i, patch) => setD((s) => ({ ...s, radiology: s.radiology.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const rmRad = (i) => setD((s) => ({ ...s, radiology: s.radiology.filter((_, j) => j !== i) }));

  // ---- Notes ----
  const setNote = (i, v) => setD((s) => ({ ...s, notes: s.notes.map((n, j) => (j === i ? v : n)) }));
  const addNote = () => setD((s) => ({ ...s, notes: ["", ...s.notes] }));
  const rmNote = (i) => setD((s) => ({ ...s, notes: s.notes.length <= 1 ? [""] : s.notes.filter((_, j) => j !== i) }));

  // ---- Immunization ----
  const toggleVaccine = (item) =>
    setD((s) => {
      const cur = s.immunization[item.id];
      return { ...s, immunization: { ...s.immunization, [item.id]: cur?.given ? { ...cur, given: false } : { given: true, date: localISODate() } } };
    });
  const setVaccineDate = (idKey, date) => setD((s) => ({ ...s, immunization: { ...s.immunization, [idKey]: { ...s.immunization[idKey], given: true, date } } }));
  const schedule = ANC_IMMUNIZATION;

  // ---- Drugs ----
  const toggleDrug = (name) => setD((s) => ({ ...s, drugs: s.drugs.includes(name) ? s.drugs.filter((x) => x !== name) : [...s.drugs, name] }));
  const catalogueDrugs = (settings.drugs || []).filter((x) => (x.type !== "Vaccine" && x.form !== "Vaccine")).map((x) => x.name);

  // ---- Delivery / babies ----
  const babies = d.delivery.babies || [];
  const setDelivery = (patch) => setD((s) => ({ ...s, delivery: { ...s.delivery, ...patch } }));
  const addBaby = () => setD((s) => ({ ...s, delivery: { ...s.delivery, babies: [...(s.delivery.babies || []), { sex: "", weightKg: "", lengthCm: "", apgar1: "", apgar5: "", outcome: "Live birth", registered: false }] } }));
  const updBaby = (i, patch) => setD((s) => ({ ...s, delivery: { ...s.delivery, babies: s.delivery.babies.map((b, j) => (j === i ? { ...b, ...patch } : b)) } }));
  const rmBaby = (i) => setD((s) => ({ ...s, delivery: { ...s.delivery, babies: s.delivery.babies.filter((_, j) => j !== i) } }));

  const doRegisterBaby = (i) => {
    const b = babies[i];
    if (b.registered) return toast.message("Baby already registered");
    if (b.outcome !== "Live birth") return toast.error("Only live births can be registered as a patient");
    const name = babyName(p.name, i, babies.length);
    const rec = registerBaby(p.id, {
      name,
      sex: b.sex,
      dob: d.delivery.date || localISODate(),
      weight: b.weightKg ? Number(b.weightKg) : "",
      height: b.lengthCm ? Number(b.lengthCm) : "",
      deliveryDetails: { ...b, motherId: p.id, motherName: p.name, deliveryDate: d.delivery.date, mode: d.delivery.mode, place: d.delivery.place },
    });
    updBaby(i, { registered: true, patientId: rec.id });
    toast.success(`${name} registered · ${rec.id}`);
  };

  const persist = (close) => {
    const episodeId =
      existing?.episodeId ||
      (() => {
        const open = patientEncs
          .filter((e) => e.disease === ANTENATAL_ID)
          .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
        if (open && !isAncEpisodeClosed(open.outcome)) return open.episodeId;
        return newAncEpisodeId();
      })();
    const outcome = d.outcome?.status || "";
    saveEncounter({
      id: existing?.id,
      patientId: p.id,
      episodeId,
      disease: ANTENATAL_ID,
      facility,
      worker: user?.name,
      type: visitType,
      diagnosis: dating.finalGa ? `GA ${dating.finalGa.text} · ${trimesterLabel(dating.trimester)}` : "",
      treatment: (d.drugs || []).join(" + "),
      outcome,
      data: { ...d, caseDetails: { ...d.caseDetails, firstContact } },
    });
    setSavedAt(new Date().toLocaleTimeString());
    if (close) navigate(`/patients/${p.id}?tab=antenatal`);
    toast.success(online ? (close ? "ANC visit saved" : "Saved to device") : "Saved · queued until online");
  };

  const sections = [
    {
      n: 1, title: "Case details (LMP · GA · EDD)",
      done: !!d.caseDetails.lmp || !!dating.finalEdd,
      body: (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="LMP (last menstrual period)" type="date" testid="anc-lmp" value={d.caseDetails.lmp || ""} onChange={(e) => setCase({ lmp: e.target.value })} hint={d.caseDetails.lmp ? fmtDate(d.caseDetails.lmp) : "Naegele's rule → EDD"} />
            <TextField label="Dating scan date" type="date" testid="anc-scan-date" value={d.caseDetails.scanDate || ""} onChange={(e) => setCase({ scanDate: e.target.value })} />
            <TextField label="GA at scan — weeks" type="number" testid="anc-scan-weeks" value={d.caseDetails.scanWeeks || ""} onChange={(e) => setCase({ scanWeeks: e.target.value })} />
            <TextField label="GA at scan — days" type="number" testid="anc-scan-days" value={d.caseDetails.scanDays || ""} onChange={(e) => setCase({ scanDays: e.target.value })} />
          </div>

          <div className="rounded-lg border border-primary/25 bg-secondary p-4" data-testid="anc-dating-panel">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">Gestational age & EDD</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[["From LMP", dating.lmpGa, dating.lmpEdd, "lmp"], ["From scan", dating.scanGa, dating.scanEdd, "scan"]].map(([lbl, ga, edd, key]) => (
                <div key={key} className="rounded-md border border-border bg-white p-3" data-testid={`anc-dating-${key}`}>
                  <p className="text-[11px] font-semibold text-muted-foreground">{lbl}</p>
                  <p className="mt-1 text-base font-bold">GA {ga?.text || "—"}</p>
                  <p className="text-xs text-muted-foreground">EDD {edd ? fmtDate(edd) : "—"}</p>
                </div>
              ))}
              <div className="rounded-md border-2 border-primary bg-white p-3" data-testid="anc-dating-final">
                <p className="text-[11px] font-semibold text-primary">Final (clinician)</p>
                <p className="mt-1 text-base font-bold">GA {dating.finalGa?.text || "—"}</p>
                <p className="text-xs text-muted-foreground">EDD {dating.finalEdd ? fmtDate(dating.finalEdd) : "—"} · {trimesterLabel(dating.trimester)}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <SelectField label="Final dating source" options={["LMP", "Scan", "Manual"]} value={dating.source} onChange={(v) => setCase({ finalSource: v })} testid="anc-final-source" />
              {dating.source === "Manual" && (
                <TextField label="Final EDD (manual)" type="date" testid="anc-final-edd" value={d.caseDetails.finalEdd || ""} onChange={(e) => setCase({ finalEdd: e.target.value })} />
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      n: 2, title: "History",
      done: Object.keys(d.history).length > 0,
      body: <MiniFieldRenderer fields={ANC_HISTORY_FIELDS} data={d.history} onChange={(v) => setD((s) => ({ ...s, history: v }))} prefix="anc-hist" />,
    },
    {
      n: 3, title: "Vitals (mother & fetal)",
      done: Object.keys(d.vitals.mother).length > 0 || Object.keys(d.vitals.fetal).length > 0,
      body: (
        <div className="space-y-6">
          <div>
            <p className="mb-3 font-head text-sm font-semibold text-primary">Mother</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MOTHER_VITALS.map((f) => <SliderStat key={f.k} field={f} value={d.vitals.mother[f.k]} onChange={(v) => setMotherV(f.k, v)} testid={`anc-mv-${f.k}`} />)}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {MOTHER_VITAL_CHOICES.map((c) => <ChoiceChips key={c.k} label={c.label} options={c.options} value={d.vitals.mother[c.k]} onChange={(v) => setMotherV(c.k, v)} testid={`anc-mv-${c.k}`} />)}
            </div>
          </div>
          <div>
            <p className="mb-3 font-head text-sm font-semibold text-primary">Fetal</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FETAL_VITALS.map((f) => <SliderStat key={f.k} field={f} value={d.vitals.fetal[f.k]} onChange={(v) => setFetalV(f.k, v)} testid={`anc-fv-${f.k}`} />)}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {FETAL_VITAL_CHOICES.map((c) => <ChoiceChips key={c.k} label={c.label} options={c.options} value={d.vitals.fetal[c.k]} onChange={(v) => setFetalV(c.k, v)} testid={`anc-fv-${c.k}`} />)}
            </div>
          </div>
        </div>
      ),
    },
    {
      n: 4, title: "Laboratory",
      done: d.lab.length > 0,
      body: (
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <input
              data-testid="anc-lab-search"
              value={labSearch}
              onChange={(e) => setLabSearch(e.target.value)}
              placeholder="Search and add a lab test…"
              className="h-11 w-full rounded-md border border-input bg-white pl-10 pr-3 text-sm"
            />
            {labSearch && (
              <div className="mt-1 max-h-52 overflow-y-auto rounded-md border border-border bg-white shadow-sm">
                {labMatches.length ? labMatches.map((t) => (
                  <button key={t.name} type="button" data-testid={`anc-lab-opt-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} onClick={() => addLab(t.name)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted">
                    <span>{t.name}</span><Plus className="h-4 w-4 text-primary" />
                  </button>
                )) : <p className="px-3 py-2 text-sm text-muted-foreground">No matching test</p>}
              </div>
            )}
          </div>
          <div className="space-y-2" data-testid="anc-lab-list">
            {d.lab.length === 0 && <p className="text-sm text-muted-foreground">No tests added yet.</p>}
            {d.lab.map((row, i) => {
              const def = ANC_LAB_TESTS.find((t) => t.name === row.test);
              return (
                <div key={i} className="rounded-md border border-border bg-white p-3" data-testid={`anc-lab-row-${i}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{row.test}</p>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-red-600" onClick={() => rmLab(i)} data-testid={`anc-lab-remove-${i}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <div className="mt-2 grid gap-3 sm:grid-cols-3">
                    <SelectField label="Result" options={def?.results || ["Normal", "Abnormal", "Pending"]} value={row.result} onChange={(v) => updLab(i, { result: v })} testid={`anc-lab-result-${i}`} />
                    <SelectField label="Location" options={facilityHasLab ? ["Bedside", "Lab"] : ["Bedside"]} value={row.location} onChange={(v) => updLab(i, { location: v })} testid={`anc-lab-location-${i}`} />
                    <TextField label="Date" type="date" value={row.date} onChange={(e) => updLab(i, { date: e.target.value })} testid={`anc-lab-date-${i}`} />
                  </div>
                  {facilityHasLab && row.location === "Lab" && (
                    <Button variant="outline" className="mt-2 h-9" data-testid={`anc-lab-send-${i}`} onClick={() => { updLab(i, { sentToLab: true }); toast.success("Order sent to Lab"); }}>
                      {row.sentToLab ? "Order sent ✓" : "Send order to Lab"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          {!facilityHasLab && <AlertPanel level="info" title="Bedside testing" testid="anc-lab-bedside-note">This facility has no Lab location configured, so results default to bedside.</AlertPanel>}
        </div>
      ),
    },
    {
      n: 5, title: "Radiology",
      done: d.radiology.length > 0,
      body: (
        <div className="space-y-3">
          <Button variant="outline" className="h-10" onClick={addRadiology} data-testid="anc-rad-add"><Plus className="mr-2 h-4 w-4" /> Add scan</Button>
          {d.radiology.map((row, i) => (
            <div key={i} className="rounded-md border border-border bg-white p-3" data-testid={`anc-rad-row-${i}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">Scan {d.radiology.length - i}</p>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-red-600" onClick={() => rmRad(i)} data-testid={`anc-rad-remove-${i}`}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <SelectField label="Scan" options={RADIOLOGY_SCANS} value={row.scan} onChange={(v) => updRad(i, { scan: v })} testid={`anc-rad-scan-${i}`} />
                <TextField label="Date" type="date" value={row.date} onChange={(e) => updRad(i, { date: e.target.value })} testid={`anc-rad-date-${i}`} />
              </div>
              <AreaField label="Findings" rows={3} value={row.findings} onChange={(e) => updRad(i, { findings: e.target.value })} testid={`anc-rad-findings-${i}`} />
            </div>
          ))}
        </div>
      ),
    },
    {
      n: 6, title: "Drugs",
      done: d.drugs.length > 0,
      body: (
        <div className="space-y-4">
          <CheckGrid label="Standard antenatal drugs" options={ANC_DRUGS} value={d.drugs} onChange={(v) => setD((s) => ({ ...s, drugs: v }))} testid="anc-drug" />
          <Field label="Add from drug list">
            <SelectField
              label=""
              options={catalogueDrugs.filter((n) => !d.drugs.includes(n))}
              value=""
              onChange={(v) => v && toggleDrug(v)}
              testid="anc-drug-add"
              placeholder="Choose a drug to add…"
            />
          </Field>
          {d.drugs.filter((n) => !ANC_DRUGS.includes(n)).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {d.drugs.filter((n) => !ANC_DRUGS.includes(n)).map((n) => (
                <span key={n} className="inline-flex items-center gap-2 rounded-full border border-primary bg-secondary px-3 py-1 text-sm font-semibold">
                  {n}<button type="button" onClick={() => toggleDrug(n)} data-testid={`anc-drug-chip-remove-${n.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}><Trash2 className="h-3.5 w-3.5 text-red-600" /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      n: 7, title: "Immunization",
      done: Object.values(d.immunization).some((x) => x?.given),
      body: (
        <div className="space-y-2" data-testid="anc-immunization">
          {schedule.map((item) => {
            const rec = d.immunization[item.id];
            const overdue = isImmunizationOverdue(item, rec, firstContact, d.caseDetails.lmp);
            const due = immunizationDueDate(item, firstContact, d.caseDetails.lmp);
            return (
              <div key={item.id} className={`flex flex-wrap items-center gap-3 rounded-md border p-3 ${rec?.given ? "border-green-500 bg-green-50" : overdue ? "border-red-500 bg-red-50" : "border-border bg-white"}`} data-testid={`anc-vac-${item.id}`}>
                <button type="button" onClick={() => toggleVaccine(item)} data-testid={`anc-vac-toggle-${item.id}`} className={`grid h-8 w-8 shrink-0 place-items-center rounded border ${rec?.given ? "border-green-600 bg-green-600 text-white" : "border-input"}`}>
                  {rec?.given && <Check className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.note} · due {due ? fmtDate(due) : "—"}{overdue ? " · OVERDUE" : ""}</p>
                </div>
                {rec?.given && (
                  <TextField label="" type="date" className="w-40" value={rec.date || ""} onChange={(e) => setVaccineDate(item.id, e.target.value)} testid={`anc-vac-date-${item.id}`} />
                )}
              </div>
            );
          })}
          {vaccineDrugs.length > 0 && (
            <Field label="Add additional vaccine from drug list">
              <SelectField label="" options={vaccineDrugs.map((v) => v.name).filter((n) => !d.immunization[n])} value="" onChange={(n) => n && setVaccineDate(n, localISODate())} testid="anc-vac-add" placeholder="Choose a vaccine…" />
            </Field>
          )}
        </div>
      ),
    },
    {
      n: 8, title: "Visit notes",
      done: d.notes.some((n) => String(n).trim()),
      body: (
        <div className="space-y-3" data-testid="anc-notes">
          {d.notes.map((note, i) => (
            <div key={i} className="rounded-md border border-border bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">Note {d.notes.length - i}</p>
                <ItemActions onAdd={addNote} addTestid={`anc-note-add-${i}`} canRemove={d.notes.length > 1} onRemove={() => rmNote(i)} removeTestid={`anc-note-remove-${i}`} />
              </div>
              <AreaField label="" rows={4} value={note} onChange={(e) => setNote(i, e.target.value)} testid={`anc-note-${i}`} />
            </div>
          ))}
        </div>
      ),
    },
    {
      n: 9, title: "Delivery & new born",
      done: !!d.delivery.date || babies.length > 0,
      body: (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Delivery date" type="date" value={d.delivery.date || ""} onChange={(e) => setDelivery({ date: e.target.value })} testid="anc-del-date" />
            <SelectField label="Mode of delivery" options={DELIVERY_MODES} value={d.delivery.mode || ""} onChange={(v) => setDelivery({ mode: v })} testid="anc-del-mode" />
            <SelectField label="Place" options={DELIVERY_PLACES} value={d.delivery.place || ""} onChange={(v) => setDelivery({ place: v })} testid="anc-del-place" />
            <TextField label="Conducted by" value={d.delivery.conducted || ""} onChange={(e) => setDelivery({ conducted: e.target.value })} testid="anc-del-conducted" />
          </div>
          <AreaField label="Maternal complications / notes" rows={2} value={d.delivery.complications || ""} onChange={(e) => setDelivery({ complications: e.target.value })} testid="anc-del-complications" />

          <div className="flex items-center justify-between">
            <p className="font-head text-sm font-semibold text-primary">New born(s){babies.length > 1 ? ` · ${babies.length} babies` : ""}</p>
            <Button variant="outline" className="h-10" onClick={addBaby} data-testid="anc-add-baby"><Baby className="mr-2 h-4 w-4" /> Add baby</Button>
          </div>
          {babies.map((b, i) => (
            <div key={i} className="rounded-md border border-border bg-white p-3" data-testid={`anc-baby-${i}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{babyName(p.name, i, babies.length)}</p>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-red-600" onClick={() => rmBaby(i)} data-testid={`anc-baby-remove-${i}`}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <SelectField label="Sex" options={BABY_SEX} value={b.sex} onChange={(v) => updBaby(i, { sex: v })} testid={`anc-baby-sex-${i}`} />
                <TextField label="Birth weight (kg)" type="number" value={b.weightKg} onChange={(e) => updBaby(i, { weightKg: e.target.value })} testid={`anc-baby-weight-${i}`} />
                <TextField label="Length (cm)" type="number" value={b.lengthCm} onChange={(e) => updBaby(i, { lengthCm: e.target.value })} testid={`anc-baby-length-${i}`} />
                <TextField label="APGAR 1 min" type="number" value={b.apgar1} onChange={(e) => updBaby(i, { apgar1: e.target.value })} testid={`anc-baby-apgar1-${i}`} />
                <TextField label="APGAR 5 min" type="number" value={b.apgar5} onChange={(e) => updBaby(i, { apgar5: e.target.value })} testid={`anc-baby-apgar5-${i}`} />
                <SelectField label="Outcome" options={BABY_OUTCOMES} value={b.outcome} onChange={(v) => updBaby(i, { outcome: v })} testid={`anc-baby-outcome-${i}`} />
              </div>
              <Button className="mt-3 h-10" disabled={b.registered} onClick={() => doRegisterBaby(i)} data-testid={`anc-baby-register-${i}`}>
                {b.registered ? `Registered · ${b.patientId}` : "Register baby"}
              </Button>
            </div>
          ))}
        </div>
      ),
    },
    {
      n: 10, title: "Outcome",
      done: !!d.outcome.status,
      body: (
        <div className="space-y-4">
          <ChoiceRow label="Pregnancy outcome" options={ANC_OUTCOMES} value={d.outcome.status} onChange={(v) => setD((s) => ({ ...s, outcome: { ...s.outcome, status: v } }))} testid="anc-outcome" />
          {isAncEpisodeClosed(d.outcome.status) && <AlertPanel level="review" title="This closes the ANC episode" testid="anc-outcome-close">Saving with this outcome closes the episode. Start a new encounter to open a fresh pregnancy episode later.</AlertPanel>}
          {(d.outcome.status === "Referred out" || d.outcome.status === "Transferred out") && (
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField label="Province" options={Object.keys(GEO)} value={d.outcome.province || ""} onChange={(v) => setD((s) => ({ ...s, outcome: { ...s.outcome, province: v, district: "" } }))} testid="anc-outcome-province" />
              <SelectField label="District" options={Object.keys(GEO[d.outcome.province] || {})} value={d.outcome.district || ""} onChange={(v) => setD((s) => ({ ...s, outcome: { ...s.outcome, district: v } }))} testid="anc-outcome-district" />
              <TextField label="Facility" value={d.outcome.facility || ""} onChange={(e) => setD((s) => ({ ...s, outcome: { ...s.outcome, facility: e.target.value } }))} testid="anc-outcome-facility" />
            </div>
          )}
          <AreaField label="Outcome notes" rows={2} value={d.outcome.note || ""} onChange={(e) => setD((s) => ({ ...s, outcome: { ...s.outcome, note: e.target.value } }))} testid="anc-outcome-note" />
        </div>
      ),
    },
  ];

  const doneCount = sections.filter((s) => s.done).length;

  return (
    <AppShell>
      <div className="grid gap-6 pb-28 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <PatientSidebar patient={p} encounters={patientEncs} diseases={[{ id: ANTENATAL_ID, name: ANTENATAL_NAME }]} testid="anc-lhs-panel" />
        <div className="min-w-0 space-y-4">
          <div className="sticky top-[65px] z-30 -mx-1 flex flex-wrap items-center gap-3 bg-background px-1 py-3 lg:top-[69px]">
            <div className="min-w-0 flex-1">
              <p className="font-head text-xl font-bold tracking-tight sm:text-2xl">{ANTENATAL_NAME} visit</p>
              <p className="text-xs text-muted-foreground" data-testid="anc-context">{facility} · {visitType}{dating.finalGa ? ` · GA ${dating.finalGa.text}` : ""}</p>
            </div>
            <Button variant="outline" className="h-11 shrink-0" data-testid="anc-exit-btn" onClick={() => navigate(`/patients/${p.id}?tab=antenatal`)}><ArrowLeft className="mr-2 h-4 w-4" /> Exit to record</Button>
          </div>

          <div className="rounded-lg border border-border bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">Visit completeness</p>
              <span className="text-sm font-semibold" data-testid="anc-completeness">{doneCount} of {sections.length} sections captured</span>
            </div>
            <Progress value={(doneCount / sections.length) * 100} className="mt-3 h-2.5" />
          </div>

          {sections.map((s) => (
            <section key={s.n} className="rounded-lg border border-border bg-white" data-testid={`anc-section-${s.n}`}>
              <button type="button" data-testid={`anc-section-toggle-${s.n}`} onClick={() => setOpen((o) => ({ ...o, [s.n]: o[s.n] === false }))} className="flex w-full items-center gap-3 px-5 py-4 text-left">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md text-sm font-bold ${s.done ? "bg-green-50 text-green-700" : "bg-secondary text-primary"}`}>{s.done ? <CircleCheck className="h-5 w-5" /> : s.n}</span>
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
          <span className="hidden text-xs text-muted-foreground sm:block" data-testid="anc-saved-indicator">{savedAt ? `Last saved: ${savedAt}` : "Draft — not saved yet"}</span>
          <div className="ml-auto flex flex-1 gap-3 sm:flex-none">
            <Button variant="outline" className="h-12 flex-1 sm:flex-none sm:px-8" data-testid="anc-save-btn" onClick={() => persist(false)}><Save className="mr-2 h-4 w-4" /> Save</Button>
            <Button className="h-12 flex-1 text-base sm:flex-none sm:px-8" data-testid="anc-save-close-btn" onClick={() => persist(true)}><Check className="mr-2 h-4 w-4" /> Save &amp; close</Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
