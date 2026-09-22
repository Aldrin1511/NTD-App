import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { AlertPanel } from "@/components/Fields";
import { FeatureCard } from "@/components/EntryKit";
import { GrowthReview } from "@/components/GrowthChart";
import { dobFromAge } from "@/components/Capture";
import { fmtDate, fmtDateTime, groupDiseaseEpisodes } from "@/mock/specs";
import { WELLBABY_ID, MILESTONES, milestoneFlag, immunizationDueFromDob, isVaccineOverdue } from "@/mock/wellbaby";
import { monthsBetween, ageMonthsToLabel } from "@/mock/growth";
import { Pencil, Plus, Check } from "lucide-react";

const chip = { green: "text-green-700", amber: "text-amber-700", red: "text-red-700", "": "text-muted-foreground" };

export default function WellBabyDashboard({ patient, encounters, settings, canEdit, onEdit, onAddVisit }) {
  const episodes = useMemo(() => groupDiseaseEpisodes(encounters, WELLBABY_ID, null), [encounters]);
  const episode = episodes[0];
  const visits = useMemo(() => [...(episode?.visits || [])].sort((a, b) => String(b.date).localeCompare(String(a.date))), [episode]);
  const dob = patient?.dob || dobFromAge(patient?.age, patient?.createdAt);
  const schedule = (settings.immunizationSchedules || []).find((s) => s.condition === WELLBABY_ID) || { vaccines: [] };

  if (!episode) return <AlertPanel level="info" title="No Well Baby data yet" testid="wb-empty">Add an encounter and choose Well Baby to start this record.</AlertPanel>;

  const growthEntries = visits.filter((v) => Object.values(v.data?.growth?.measures || {}).some(Boolean)).map((v) => ({ date: v.date, ageMonths: v.data.ageMonths ?? monthsBetween(dob, v.date), measures: v.data.growth.measures, standard: v.data.growth.standard }));
  const mergedImmun = {}; visits.forEach((v) => Object.entries(v.data?.immunization || {}).forEach(([k, val]) => { if (val?.given) mergedImmun[k] = val; }));
  const mergedMs = {}; visits.forEach((v) => Object.entries(v.data?.milestones || {}).forEach(([k, val]) => { if (val?.achieved) mergedMs[k] = val; }));
  const ageMonths = monthsBetween(dob, new Date());
  const complaintVisits = visits.filter((v) => (v.data?.complaints || []).length);
  const allergyAll = [...new Set(visits.flatMap((v) => v.data?.allergy || []))];
  const noteVisits = visits.filter((v) => (v.data?.notes || []).some((n) => String(n).trim()));

  return (
    <div className="space-y-4" data-testid="wb-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-secondary px-4 py-3">
        <div><p className="font-semibold">Well Baby record · {visits.length} visit{visits.length === 1 ? "" : "s"}</p><p className="mt-0.5 text-xs font-medium text-secondary-foreground/80">Current age {ageMonthsToLabel(ageMonths)} · DOB {dob ? fmtDate(dob) : "—"}</p></div>
        {canEdit && <Button className="h-10" onClick={onAddVisit} data-testid="wb-add-visit"><Plus className="mr-1 h-4 w-4" /> Well baby visit</Button>}
      </div>

      {allergyAll.length > 0 && <AlertPanel level="review" title="Allergies" testid="wb-allergy-banner">{allergyAll.join(" · ")}</AlertPanel>}

      <FeatureCard title="Growth chart" testid="wb-feat-growth">
        <GrowthReview sex={patient.sex || patient.gender} dob={dob} entries={growthEntries} testid="wb-growth-review" />
      </FeatureCard>

      <FeatureCard title="Immunization" count={Object.keys(mergedImmun).length} testid="wb-feat-immunization">
        <div className="space-y-2">
          {(schedule.vaccines || []).map((item) => { const rec = mergedImmun[item.id]; const overdue = isVaccineOverdue(item, rec, dob); const due = immunizationDueFromDob(item, dob); return (
            <div key={item.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${rec?.given ? "border-green-500 bg-green-50" : overdue ? "border-red-500 bg-red-50" : "border-border bg-white"}`} data-testid={`wb-dash-vac-${item.id}`}>
              <span className="flex items-center gap-2 font-semibold">{rec?.given && <Check className="h-4 w-4 text-green-600" />}{item.name}</span>
              <span className={rec?.given ? "font-semibold text-green-700" : overdue ? "font-semibold text-red-700" : "text-muted-foreground"}>{rec?.given ? `Given ${rec.date ? fmtDate(rec.date) : ""}` : overdue ? `Overdue (due ${due ? fmtDate(due) : "—"})` : `Due ${due ? fmtDate(due) : "—"}`}</span>
            </div>
          ); })}
        </div>
      </FeatureCard>

      <FeatureCard title="Gross motor milestones" count={Object.keys(mergedMs).length} testid="wb-feat-milestones">
        <div className="space-y-2">
          {MILESTONES.map((m) => { const rec = mergedMs[m.id]; const flag = milestoneFlag(m, rec, ageMonths); return (
            <div key={m.id} className="flex items-center justify-between rounded-md border border-border bg-white px-3 py-2 text-sm" data-testid={`wb-dash-ms-${m.id}`}>
              <span className="font-semibold">{m.name}</span>
              <span className={`font-semibold ${chip[flag]}`}>{rec?.achieved ? `Achieved ${rec.date ? fmtDate(rec.date) : ""}` : flag === "red" ? "Delayed" : `Expected ${m.min}–${m.max} mo`}</span>
            </div>
          ); })}
        </div>
      </FeatureCard>

      {complaintVisits.length > 0 && (
        <FeatureCard title="Chief complaints" count={complaintVisits.length} lastAt={fmtDateTime(complaintVisits[0].date)} testid="wb-feat-complaints">
          {complaintVisits.map((v) => (
            <div key={v.id} className="border-b border-border/60 py-2 last:border-0">
              <div className="flex items-center justify-between"><p className="text-xs font-semibold text-primary">{fmtDateTime(v.date)} · {v.worker}</p>{canEdit && <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => onEdit(v)}><Pencil className="h-4 w-4" /></Button>}</div>
              <p className="mt-1 text-sm font-medium">{v.data.complaints.join(" · ")}</p>
            </div>
          ))}
        </FeatureCard>
      )}

      {noteVisits.length > 0 && (
        <FeatureCard title="Visit notes" count={noteVisits.length} lastAt={fmtDateTime(noteVisits[0].date)} testid="wb-feat-notes">
          {noteVisits.map((v) => (
            <div key={v.id} className="border-b border-border/60 py-2 last:border-0">
              <div className="flex items-center justify-between"><p className="text-xs font-semibold text-primary">{fmtDateTime(v.date)} · {v.worker} · {v.type}</p>{canEdit && <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => onEdit(v)}><Pencil className="h-4 w-4" /></Button>}</div>
              {(v.data.notes || []).filter((n) => String(n).trim()).map((n, i) => <p key={i} className="mt-1 whitespace-pre-line text-sm">{n}</p>)}
            </div>
          ))}
        </FeatureCard>
      )}
    </div>
  );
}
