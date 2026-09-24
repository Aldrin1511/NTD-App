import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Field, TextField, AreaField, SelectField, AlertPanel, ItemActions } from "@/components/Fields";
import { ConditionEntryShell, ChipMultiWithOther, ChoiceChips } from "@/components/EntryKit";
import { GrowthEntry } from "@/components/GrowthChart";
import { dobFromAge } from "@/components/Capture";
import { monthsBetween, ageMonthsToLabel } from "@/mock/growth";
import { localISODate, fmtDate } from "@/mock/specs";
import {
  WELLBABY_ID, WELLBABY_NAME, CHIEF_COMPLAINTS, ALLERGIES, MILESTONES, WELLBABY_DRUGS,
  immunizationDueFromDob, isVaccineOverdue, groupVaccinesByFamily, milestoneFlag, newWbEpisodeId,
} from "@/mock/wellbaby";
import { toast } from "sonner";
import { Check, Trash2, Plus, Search } from "lucide-react";

const empty = () => ({ delivery: {}, complaints: [], allergy: [], growth: { standard: "WHO", mode: "Percentile", measures: {} }, immunization: {}, milestones: {}, notes: [""], drugs: [], lab: [] });

export default function WellBabyEncounter() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { patients, encounters, saveEncounter, user, settings, online } = useStore();
  const p = patients.find((x) => x.id === id);
  const existing = encounters.find((e) => e.id === params.get("enc") && e.disease === WELLBABY_ID);
  const patientEncs = useMemo(() => encounters.filter((e) => e.patientId === id), [encounters, id]);
  const [d, setD] = useState(() => ({ ...empty(), ...(existing?.data || {}) }));
  const [savedAt, setSavedAt] = useState(existing ? "loaded from record" : "");
  const [labSearch, setLabSearch] = useState("");
  const facility = existing?.facility || params.get("fac") || p?.facility || "";
  const visitType = existing?.type || params.get("vt") || "Well baby visit";

  const dob = p?.dob || dobFromAge(p?.age, p?.createdAt);
  const visitDate = existing?.date || localISODate();
  const ageMonths = monthsBetween(dob, visitDate);
  const schedule = (settings.immunizationSchedules || []).find((s) => s.condition === WELLBABY_ID) || { vaccines: [] };
  const labMaster = settings.labMaster || [];
  const vaccineDrugs = (settings.drugs || []).filter((x) => x.type === "Vaccine" || x.form === "Vaccine");

  if (!p) return <div className="p-8">Patient not found. <Button onClick={() => navigate("/patients")}>Back</Button></div>;

  const set = (k, v) => setD((s) => ({ ...s, [k]: v }));
  const setDelivery = (patch) => setD((s) => ({ ...s, delivery: { ...s.delivery, ...patch } }));
  const preFill = existing ? d.delivery : { ...(p.deliveryDetails || {}), ...d.delivery };

  const toggleVaccine = (item) => setD((s) => { const cur = s.immunization[item.id]; return { ...s, immunization: { ...s.immunization, [item.id]: cur?.given ? { given: false } : { given: true, date: localISODate() } } }; });
  const setVaccineDate = (k, date) => setD((s) => ({ ...s, immunization: { ...s.immunization, [k]: { given: true, date } } }));
  const toggleMilestone = (m) => setD((s) => { const cur = s.milestones[m.id]; return { ...s, milestones: { ...s.milestones, [m.id]: cur?.achieved ? { achieved: false } : { achieved: true, date: localISODate() } } }; });
  const setMilestoneDate = (mid, date) => setD((s) => ({ ...s, milestones: { ...s.milestones, [mid]: { achieved: true, date } } }));

  const addLab = (name) => { const def = labMaster.find((t) => t.name === name); setD((s) => ({ ...s, lab: [{ test: name, result: "", location: def?.location || "Bedside", date: localISODate() }, ...s.lab] })); setLabSearch(""); };
  const updLab = (i, patch) => setD((s) => ({ ...s, lab: s.lab.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const rmLab = (i) => setD((s) => ({ ...s, lab: s.lab.filter((_, j) => j !== i) }));
  const labMatches = labMaster.filter((t) => t.name.toLowerCase().includes(labSearch.toLowerCase()) && !d.lab.some((x) => x.test === t.name));

  const setNote = (i, v) => setD((s) => ({ ...s, notes: s.notes.map((n, j) => (j === i ? v : n)) }));
  const addNote = () => setD((s) => ({ ...s, notes: ["", ...s.notes] }));
  const rmNote = (i) => setD((s) => ({ ...s, notes: s.notes.length <= 1 ? [""] : s.notes.filter((_, j) => j !== i) }));
  const toggleDrug = (name) => setD((s) => ({ ...s, drugs: s.drugs.includes(name) ? s.drugs.filter((x) => x !== name) : [...s.drugs, name] }));
  const catalogueDrugs = (settings.drugs || []).filter((x) => x.type !== "Vaccine" && x.form !== "Vaccine").map((x) => x.name);

  const persist = (close) => {
    const episodeId = existing?.episodeId || patientEncs.filter((e) => e.disease === WELLBABY_ID)[0]?.episodeId || newWbEpisodeId();
    saveEncounter({
      id: existing?.id, patientId: p.id, episodeId, disease: WELLBABY_ID, facility, worker: user?.name, type: visitType,
      diagnosis: ageMonths != null ? `Age ${ageMonthsToLabel(ageMonths)}` : "",
      outcome: "", data: { ...d, delivery: preFill, ageMonths, growthAge: ageMonths },
    });
    setSavedAt(new Date().toLocaleTimeString());
    if (close) navigate(`/patients/${p.id}?tab=wellbaby`);
    toast.success(online ? (close ? "Well baby visit saved" : "Saved to device") : "Saved · queued until online");
  };

  const sections = [
    {
      title: "Delivery & new born details",
      done: Object.keys(preFill).length > 0,
      body: (
        <div className="space-y-3">
          {p.deliveryDetails && <AlertPanel level="info" title="Auto-populated from delivery record" testid="wb-delivery-auto">Imported from the mother's Ante Natal delivery record. Edit if needed.</AlertPanel>}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Delivery date" type="date" value={preFill.deliveryDate || preFill.date || dob || ""} onChange={(e) => setDelivery({ deliveryDate: e.target.value })} testid="wb-del-date" />
            <TextField label="Mode" value={preFill.mode || ""} onChange={(e) => setDelivery({ mode: e.target.value })} testid="wb-del-mode" />
            <TextField label="Birth weight (kg)" type="number" value={preFill.weightKg || p.weight || ""} onChange={(e) => setDelivery({ weightKg: e.target.value })} testid="wb-del-weight" />
            <TextField label="Birth length (cm)" type="number" value={preFill.lengthCm || ""} onChange={(e) => setDelivery({ lengthCm: e.target.value })} testid="wb-del-length" />
            <TextField label="APGAR 1/5" value={`${preFill.apgar1 || "—"}/${preFill.apgar5 || "—"}`} readOnly />
            <TextField label="Place of birth" value={preFill.place || ""} onChange={(e) => setDelivery({ place: e.target.value })} testid="wb-del-place" />
          </div>
        </div>
      ),
    },
    { title: "Chief complaints", done: d.complaints.length > 0, body: <ChipMultiWithOther label="Select complaints (or add other)" options={CHIEF_COMPLAINTS} value={d.complaints} onChange={(v) => set("complaints", v)} testid="wb-complaints" /> },
    { title: "Allergy", done: d.allergy.length > 0, body: <ChipMultiWithOther label="Known allergies (or add other)" options={ALLERGIES} value={d.allergy} onChange={(v) => set("allergy", v)} testid="wb-allergy" placeholder="Add other allergy…" /> },
    { title: "Growth chart", done: Object.values(d.growth.measures || {}).some(Boolean), body: <GrowthEntry sex={p.sex || p.gender} ageMonths={ageMonths} value={d.growth} onChange={(v) => set("growth", v)} testid="wb-growth" /> },
    {
      title: "Immunization", done: Object.values(d.immunization).some((x) => x?.given),
      body: (
        <div className="space-y-2" data-testid="wb-immunization">
          <p className="text-xs text-muted-foreground">Schedule: <b>{schedule.name || "—"}</b> (edit in Admin → Masters)</p>
          {groupVaccinesByFamily(schedule.vaccines || []).map((group) => (
            <div key={group.family} className="flex flex-wrap gap-2" data-testid={`wb-vac-group-${group.family}`}>
              {group.doses.map((item) => {
                const rec = d.immunization[item.id];
                const overdue = isVaccineOverdue(item, rec, dob);
                const due = immunizationDueFromDob(item, dob);
                return (
                  <div
                    key={item.id}
                    className={`flex w-[calc((100%-1rem)/3)] items-start gap-1.5 rounded-md border p-2 ${rec?.given ? "border-green-500 bg-green-50" : overdue ? "border-red-500 bg-red-50" : "border-border bg-white"}`}
                    data-testid={`wb-vac-${item.id}`}
                  >
                    <button type="button" onClick={() => toggleVaccine(item)} data-testid={`wb-vac-toggle-${item.id}`} className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center" aria-label={rec?.given ? "Mark not given" : "Mark given"}>
                      <Check className={`h-3.5 w-3.5 ${rec?.given ? "text-green-600" : "text-muted-foreground/40"}`} strokeWidth={rec?.given ? 3 : 2} />
                    </button>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-semibold leading-tight">{item.name}</p>
                      <p className="text-[10px] leading-snug text-muted-foreground">{item.note} · due {due ? fmtDate(due) : "—"}{overdue ? " · OVERDUE" : ""}</p>
                      {rec?.given && (
                        <input
                          type="date"
                          className="h-7 w-[7.5rem] max-w-full rounded border border-input bg-white px-1.5 text-[11px]"
                          value={rec.date || ""}
                          onChange={(e) => setVaccineDate(item.id, e.target.value)}
                          data-testid={`wb-vac-date-${item.id}`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {vaccineDrugs.length > 0 && <Field label="Add additional vaccine from drug list"><SelectField label="" options={vaccineDrugs.map((v) => v.name).filter((n) => !d.immunization[n])} value="" onChange={(n) => n && setVaccineDate(n, localISODate())} testid="wb-vac-add" placeholder="Choose a vaccine…" /></Field>}
        </div>
      ),
    },
    {
      title: "Gross motor milestones", done: Object.values(d.milestones).some((x) => x?.achieved),
      body: (
        <div className="space-y-2" data-testid="wb-milestones">
          <p className="text-xs text-muted-foreground">WHO windows · red = beyond expected age for current age {ageMonthsToLabel(ageMonths)}</p>
          {MILESTONES.map((m) => {
            const rec = d.milestones[m.id];
            const flag = milestoneFlag(m, rec, ageMonths);
            const cls = flag === "green" ? "border-green-500 bg-green-50" : flag === "red" ? "border-red-500 bg-red-50" : flag === "amber" ? "border-amber-500 bg-amber-50" : "border-border bg-white";
            return (
              <div key={m.id} className={`flex flex-wrap items-center gap-3 rounded-md border p-3 ${cls}`} data-testid={`wb-ms-${m.id}`}>
                <button type="button" onClick={() => toggleMilestone(m)} data-testid={`wb-ms-toggle-${m.id}`} className={`grid h-8 w-8 shrink-0 place-items-center rounded border ${rec?.achieved ? "border-green-600 bg-green-600 text-white" : "border-input"}`}>{rec?.achieved && <Check className="h-4 w-4" />}</button>
                <div className="min-w-0 flex-1"><p className="font-semibold">{m.name}</p><p className="text-xs text-muted-foreground">Expected {m.min}–{m.max} mo{flag === "red" && !rec?.achieved ? " · DELAYED" : ""}</p></div>
                {rec?.achieved && <TextField label="" type="date" className="w-40" value={rec.date || ""} onChange={(e) => setMilestoneDate(m.id, e.target.value)} testid={`wb-ms-date-${m.id}`} />}
              </div>
            );
          })}
        </div>
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
      title: "Drugs", done: d.drugs.length > 0,
      body: (
        <div className="space-y-4">
          <ChoiceChips multi label="Age-relevant drugs" options={WELLBABY_DRUGS} value={d.drugs} onChange={(v) => set("drugs", v)} testid="wb-drug" />
          <Field label="Add from drug list"><SelectField label="" options={catalogueDrugs.filter((n) => !d.drugs.includes(n))} value="" onChange={(v) => v && toggleDrug(v)} testid="wb-drug-add" placeholder="Choose a drug…" /></Field>
        </div>
      ),
    },
    {
      title: "Laboratory", done: d.lab.length > 0,
      body: (
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <input data-testid="wb-lab-search" value={labSearch} onChange={(e) => setLabSearch(e.target.value)} placeholder="Search and add a lab test…" className="h-11 w-full rounded-md border border-input bg-white pl-10 pr-3 text-sm" />
            {labSearch && <div className="mt-1 max-h-52 overflow-y-auto rounded-md border border-border bg-white shadow-sm">{labMatches.length ? labMatches.map((t) => <button key={t.id} type="button" data-testid={`wb-lab-opt-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} onClick={() => addLab(t.name)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"><span>{t.name}</span><Plus className="h-4 w-4 text-primary" /></button>) : <p className="px-3 py-2 text-sm text-muted-foreground">No matching test</p>}</div>}
          </div>
          <div className="space-y-2" data-testid="wb-lab-list">
            {d.lab.map((row, i) => { const def = labMaster.find((t) => t.name === row.test); return (
              <div key={i} className="rounded-md border border-border bg-white p-3" data-testid={`wb-lab-row-${i}`}>
                <div className="flex items-center justify-between"><p className="font-semibold">{row.test}</p><Button variant="ghost" size="icon" className="h-9 w-9 text-red-600" onClick={() => rmLab(i)} data-testid={`wb-lab-remove-${i}`}><Trash2 className="h-4 w-4" /></Button></div>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <SelectField label="Result" options={def?.results || ["Normal", "Abnormal", "Pending"]} value={row.result} onChange={(v) => updLab(i, { result: v })} testid={`wb-lab-result-${i}`} />
                  <SelectField label="Location" options={["Bedside", "Lab"]} value={row.location} onChange={(v) => updLab(i, { location: v })} testid={`wb-lab-location-${i}`} />
                  <TextField label="Date" type="date" value={row.date} onChange={(e) => updLab(i, { date: e.target.value })} testid={`wb-lab-date-${i}`} />
                </div>
              </div>
            ); })}
          </div>
        </div>
      ),
    },
  ];

  return (
    <ConditionEntryShell
      patient={p} patientEncs={patientEncs} sidebarDiseases={[{ id: WELLBABY_ID, name: WELLBABY_NAME }]}
      title={`${WELLBABY_NAME} visit`} context={`${facility} · ${visitType} · ${ageMonthsToLabel(ageMonths)}`}
      sections={sections} onSave={persist} savedAt={savedAt} backTo={() => navigate(`/patients/${p.id}?tab=wellbaby`)}
    />
  );
}
