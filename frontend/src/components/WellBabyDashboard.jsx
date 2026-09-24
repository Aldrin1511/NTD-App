import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { AlertPanel } from "@/components/Fields";
import { FeatureCard } from "@/components/EntryKit";
import { GrowthReview } from "@/components/GrowthChart";
import { dobFromAge } from "@/components/Capture";
import { fmtDate, fmtDateTime, groupDiseaseEpisodes } from "@/mock/specs";
import { WELLBABY_ID, MILESTONES, milestoneFlag, immunizationDueFromDob, isVaccineOverdue, groupVaccinesByFamily } from "@/mock/wellbaby";
import { monthsBetween, ageMonthsToLabel } from "@/mock/growth";
import { Pencil, Plus, Check } from "lucide-react";

const chip = { green: "text-green-700", amber: "text-amber-700", red: "text-red-700", "": "text-muted-foreground" };

const VisitHead = ({ v, onEdit, canEdit, testid }) => (
  <div className="mb-2 flex items-start justify-between gap-2">
    <p className="text-xs font-semibold text-primary">{fmtDateTime(v.date)} · {v.worker} · {v.type}</p>
    {canEdit && onEdit && (
      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => onEdit(v)} data-testid={testid || `wb-edit-${v.id}`} aria-label="Edit visit">
        <Pencil className="h-4 w-4" />
      </Button>
    )}
  </div>
);

const VaccineBoxes = ({ vaccines, records, dob, testidPrefix = "wb-dash-vac" }) => (
  <div className="space-y-2">
    {groupVaccinesByFamily(vaccines || []).map((group) => (
      <div key={group.family} className="flex flex-wrap gap-2" data-testid={`${testidPrefix}-group-${group.family}`}>
        {group.doses.map((item) => {
          const rec = records[item.id];
          const overdue = isVaccineOverdue(item, rec, dob);
          const due = immunizationDueFromDob(item, dob);
          return (
            <div
              key={item.id}
              className={`flex w-[calc((100%-1rem)/3)] items-start gap-1.5 rounded-md border p-2 ${rec?.given ? "border-green-500 bg-green-50" : overdue ? "border-red-500 bg-red-50" : "border-border bg-white"}`}
              data-testid={`${testidPrefix}-${item.id}`}
            >
              <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center">
                {rec?.given && <Check className="h-3.5 w-3.5 text-green-600" strokeWidth={3} />}
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm font-semibold leading-tight">{item.name}</p>
                <p className={`text-[10px] leading-snug ${rec?.given ? "font-semibold text-green-700" : overdue ? "font-semibold text-red-700" : "text-muted-foreground"}`}>
                  {rec?.given ? `Given ${rec.date ? fmtDate(rec.date) : ""}` : overdue ? `Overdue · due ${due ? fmtDate(due) : "—"}` : `${item.note || ""} · due ${due ? fmtDate(due) : "—"}`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    ))}
  </div>
);

export default function WellBabyDashboard({ patient, encounters, settings, canEdit, onEdit, onAddVisit }) {
  const episodes = useMemo(() => groupDiseaseEpisodes(encounters, WELLBABY_ID, null), [encounters]);
  const episode = episodes[0];
  const visits = useMemo(() => [...(episode?.visits || [])].sort((a, b) => String(b.date).localeCompare(String(a.date))), [episode]);
  const dob = patient?.dob || dobFromAge(patient?.age, patient?.createdAt);
  const schedule = (settings.immunizationSchedules || []).find((s) => s.condition === WELLBABY_ID) || { vaccines: [] };

  if (!episode) return <AlertPanel level="info" title="No Well Baby data yet" testid="wb-empty">Add an encounter and choose Well Baby to start this record.</AlertPanel>;

  const growthEntries = visits.filter((v) => Object.values(v.data?.growth?.measures || {}).some(Boolean)).map((v) => ({ date: v.date, ageMonths: v.data.ageMonths ?? monthsBetween(dob, v.date), measures: v.data.growth.measures, standard: v.data.growth.standard }));
  const growthVisits = visits.filter((v) => Object.values(v.data?.growth?.measures || {}).some(Boolean));
  const immunVisits = visits.filter((v) => Object.values(v.data?.immunization || {}).some((x) => x?.given));
  const msVisits = visits.filter((v) => Object.values(v.data?.milestones || {}).some((x) => x?.achieved));
  const mergedImmun = {}; visits.forEach((v) => Object.entries(v.data?.immunization || {}).forEach(([k, val]) => { if (val?.given) mergedImmun[k] = val; }));
  const mergedMs = {}; visits.forEach((v) => Object.entries(v.data?.milestones || {}).forEach(([k, val]) => { if (val?.achieved) mergedMs[k] = val; }));
  const ageMonths = monthsBetween(dob, new Date());
  const complaintVisits = visits.filter((v) => (v.data?.complaints || []).length);
  const allergyAll = [...new Set(visits.flatMap((v) => v.data?.allergy || []))];
  const noteVisits = visits.filter((v) => (v.data?.notes || []).some((n) => String(n).trim()));
  const editVisit = immunVisits[0] || visits[0];

  return (
    <div className="space-y-4" data-testid="wb-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-secondary px-4 py-3">
        <div><p className="font-semibold">Well Baby record · {visits.length} visit{visits.length === 1 ? "" : "s"}</p><p className="mt-0.5 text-xs font-medium text-secondary-foreground/80">Current age {ageMonthsToLabel(ageMonths)} · DOB {dob ? fmtDate(dob) : "—"}</p></div>
        {canEdit && <Button className="h-10" onClick={onAddVisit} data-testid="wb-add-visit"><Plus className="mr-1 h-4 w-4" /> Well baby visit</Button>}
      </div>

      {allergyAll.length > 0 && <AlertPanel level="review" title="Allergies" testid="wb-allergy-banner">{allergyAll.join(" · ")}</AlertPanel>}

      <FeatureCard title="Growth chart" count={growthVisits.length || undefined} lastAt={growthVisits[0] ? fmtDateTime(growthVisits[0].date) : undefined} testid="wb-feat-growth">
        {growthVisits[0] && <VisitHead v={growthVisits[0]} onEdit={onEdit} canEdit={canEdit} testid={`wb-growth-edit-${growthVisits[0].id}`} />}
        <GrowthReview sex={patient.sex || patient.gender} dob={dob} entries={growthEntries} testid="wb-growth-review" />
      </FeatureCard>

      <FeatureCard title="Immunization" count={immunVisits.length || Object.keys(mergedImmun).length} lastAt={editVisit ? fmtDateTime(editVisit.date) : undefined} testid="wb-feat-immunization">
        {immunVisits.length > 0 ? (
          immunVisits.map((v, idx) => {
            const visitGiven = {};
            Object.entries(v.data?.immunization || {}).forEach(([k, val]) => { if (val?.given) visitGiven[k] = val; });
            // Latest visit shows full schedule status; older visits show only doses given that day
            const records = idx === 0 ? mergedImmun : visitGiven;
            const vaccines = idx === 0
              ? schedule.vaccines
              : (schedule.vaccines || []).filter((item) => visitGiven[item.id]);
            return (
              <div key={v.id} className="border-b border-border/60 py-2 last:border-0" data-testid={`wb-immun-entry-${v.id}`}>
                <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} testid={`wb-immun-edit-${v.id}`} />
                <VaccineBoxes vaccines={vaccines} records={records} dob={dob} testidPrefix={`wb-dash-vac-${v.id}`} />
              </div>
            );
          })
        ) : (
          <div data-testid="wb-immun-entry-empty">
            {editVisit && <VisitHead v={editVisit} onEdit={onEdit} canEdit={canEdit} testid={`wb-immun-edit-${editVisit.id}`} />}
            <VaccineBoxes vaccines={schedule.vaccines} records={mergedImmun} dob={dob} />
          </div>
        )}
      </FeatureCard>

      <FeatureCard title="Gross motor milestones" count={msVisits.length || Object.keys(mergedMs).length} lastAt={msVisits[0] ? fmtDateTime(msVisits[0].date) : undefined} testid="wb-feat-milestones">
        {(msVisits[0] || visits[0]) && <VisitHead v={msVisits[0] || visits[0]} onEdit={onEdit} canEdit={canEdit} testid="wb-ms-edit" />}
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
              <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} testid={`wb-complaint-edit-${v.id}`} />
              <p className="text-sm font-medium">{v.data.complaints.join(" · ")}</p>
            </div>
          ))}
        </FeatureCard>
      )}

      {noteVisits.length > 0 && (
        <FeatureCard title="Visit notes" count={noteVisits.length} lastAt={fmtDateTime(noteVisits[0].date)} testid="wb-feat-notes">
          {noteVisits.map((v) => (
            <div key={v.id} className="border-b border-border/60 py-2 last:border-0">
              <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} testid={`wb-note-edit-${v.id}`} />
              {(v.data.notes || []).filter((n) => String(n).trim()).map((n, i) => <p key={i} className="mt-1 whitespace-pre-line text-sm">{n}</p>)}
            </div>
          ))}
        </FeatureCard>
      )}
    </div>
  );
}
