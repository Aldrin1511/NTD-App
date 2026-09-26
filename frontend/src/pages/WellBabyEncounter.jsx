import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Field, TextField, AreaField, SelectField, AlertPanel, ItemActions } from "@/components/Fields";
import { ConditionEntryShell, ChipMultiWithOther } from "@/components/EntryKit";
import { GrowthEntry } from "@/components/GrowthChart";
import MilestoneChart from "@/components/MilestoneChart";
import { dobFromAge } from "@/components/Capture";
import { monthsBetween, ageMonthsToLabel } from "@/mock/growth";
import { localISODate } from "@/mock/specs";
import {
  WELLBABY_ID, WELLBABY_NAME, CHIEF_COMPLAINTS, ALLERGIES, WELLBABY_DRUGS, WELLBABY_DRUG_META,
  WELLBABY_LAB_TESTS, immunizationDueFromDob, isVaccineOverdue, newWbEpisodeId,
  entryVisibleVaccines, entryDropdownVaccines,
} from "@/mock/wellbaby";
import { ImmunizationEntryCards } from "@/components/ImmunizationCards";
import AntenatalMedications from "@/components/AntenatalMedications";
import { toast } from "sonner";

const emptyLabRow = (name) => ({
  test: name || WELLBABY_LAB_TESTS[0]?.name || "HIV test",
  result: "",
  analyte: "",
  location: "Bedside",
  date: localISODate(),
  sentToLab: false,
  completed: false,
});

const empty = () => ({
  delivery: {}, complaints: [], allergy: [], growth: { standard: "WHO", mode: "Percentile", measures: {} },
  immunization: {}, milestones: {}, notes: [""], drugs: [], posology: {}, medCourses: {},
  lab: WELLBABY_LAB_TESTS.map((t) => emptyLabRow(t.name)),
});

export default function WellBabyEncounter() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { patients, encounters, saveEncounter, user, settings, facilities, online } = useStore();
  const p = patients.find((x) => x.id === id);
  const existing = encounters.find((e) => e.id === params.get("enc") && e.disease === WELLBABY_ID);
  const patientEncs = useMemo(() => encounters.filter((e) => e.patientId === id), [encounters, id]);
  const [d, setD] = useState(() => {
    const base = { ...empty(), ...(existing?.data || {}) };
    if (!Array.isArray(base.lab)) base.lab = [];
    if (!base.lab.length) {
      base.lab = WELLBABY_LAB_TESTS.map((t) => emptyLabRow(t.name));
    } else {
      const missing = WELLBABY_LAB_TESTS.filter((t) => !base.lab.some((r) => r.test === t.name));
      if (missing.length) {
        base.lab = [...base.lab, ...missing.map((t) => emptyLabRow(t.name))];
      }
    }
    return base;
  });
  const [savedAt, setSavedAt] = useState(existing ? "loaded from record" : "");
  const [revealedVacIds, setRevealedVacIds] = useState([]);
  const facility = existing?.facility || params.get("fac") || p?.facility || "";
  const visitType = existing?.type || params.get("vt") || "Well baby visit";

  const dob = p?.dob || dobFromAge(p?.age, p?.createdAt);
  const visitDate = existing?.date || localISODate();
  const ageMonths = monthsBetween(dob, visitDate);
  const schedule = (settings.immunizationSchedules || []).find((s) => s.condition === WELLBABY_ID) || { vaccines: [] };
  const vaccineDrugs = (settings.drugs || []).filter((x) => x.type === "Vaccine" || x.form === "Vaccine");
  const facilityHasLab = useMemo(() => (facilities || []).some((f) => f.name === facility && f.hasLab), [facilities, facility]);

  if (!p) return <div className="p-8">Patient not found. <Button onClick={() => navigate("/patients")}>Back</Button></div>;

  const set = (k, v) => setD((s) => ({ ...s, [k]: v }));
  const setDelivery = (patch) => setD((s) => ({ ...s, delivery: { ...s.delivery, ...patch } }));
  const preFill = existing ? d.delivery : { ...(p.deliveryDetails || {}), ...d.delivery };

  const toggleVaccine = (item) => setD((s) => { const cur = s.immunization[item.id]; return { ...s, immunization: { ...s.immunization, [item.id]: cur?.given ? { given: false } : { given: true, date: localISODate() } } }; });
  const setVaccineDate = (k, date) => setD((s) => ({ ...s, immunization: { ...s.immunization, [k]: { given: true, date } } }));
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
  const toggleMilestone = (m) => setD((s) => { const cur = s.milestones[m.id]; return { ...s, milestones: { ...s.milestones, [m.id]: cur?.achieved ? { achieved: false } : { achieved: true, date: localISODate() } } }; });
  const setMilestoneDate = (mid, date) => setD((s) => ({ ...s, milestones: { ...s.milestones, [mid]: { achieved: true, date } } }));
  const clearMilestone = (mid) => setD((s) => ({ ...s, milestones: { ...s.milestones, [mid]: { achieved: false } } }));

  const labTestNames = WELLBABY_LAB_TESTS.map((t) => t.name);

  const addLabForTest = (testName, afterIndex) => {
    const row = emptyLabRow(testName);
    setD((s) => {
      if (afterIndex == null) {
        const lastIdx = s.lab.reduce((acc, r, i) => (r.test === testName ? i : acc), -1);
        if (lastIdx < 0) return { ...s, lab: [row, ...s.lab] };
        const next = [...s.lab];
        next.splice(lastIdx + 1, 0, row);
        return { ...s, lab: next };
      }
      const next = [...s.lab];
      next.splice(afterIndex + 1, 0, row);
      return { ...s, lab: next };
    });
  };
  const updLab = (i, patch) => setD((s) => ({ ...s, lab: s.lab.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const rmLab = (i) => setD((s) => {
    const removed = s.lab[i];
    const next = s.lab.filter((_, j) => j !== i);
    if (removed && labTestNames.includes(removed.test) && !next.some((r) => r.test === removed.test)) {
      return { ...s, lab: [...next, emptyLabRow(removed.test)] };
    }
    return { ...s, lab: next };
  });

  const setNote = (i, v) => setD((s) => ({ ...s, notes: s.notes.map((n, j) => (j === i ? v : n)) }));
  const addNote = () => setD((s) => ({ ...s, notes: ["", ...s.notes] }));
  const rmNote = (i) => setD((s) => ({ ...s, notes: s.notes.length <= 1 ? [""] : s.notes.filter((_, j) => j !== i) }));
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
          onChange={(patch) => setD((s) => ({ ...s, ...patch }))}
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
                              onChange={(v) => updLab(i, { result: v, completed: !!v })}
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
                              label="Date"
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
      title={`${WELLBABY_NAME} visit`} context={`${facility} · ${visitType} · ${ageMonthsToLabel(ageMonths)}`}
      sections={sections} onSave={persist} savedAt={savedAt} focusSection={focusSection}
      backTo={() => navigate(`/patients/${p.id}?tab=wellbaby`)}
    />
  );
}
