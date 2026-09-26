import { Fragment, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { AlertPanel } from "@/components/Fields";
import { FeatureCard } from "@/components/EntryKit";
import { GrowthReview } from "@/components/GrowthChart";
import MilestoneChart from "@/components/MilestoneChart";
import { dobFromAge } from "@/components/Capture";
import { fmtDate, fmtDateTime, groupDiseaseEpisodes } from "@/mock/specs";
import { WELLBABY_ID, immunizationDueFromDob, isVaccineOverdue, WELLBABY_DRUG_META } from "@/mock/wellbaby";
import { monthsBetween, ageMonthsToLabel } from "@/mock/growth";
import { ImmunizationDashCards } from "@/components/ImmunizationCards";
import { medicationRows } from "@/components/AntenatalMedications";
import { Pencil, Plus } from "lucide-react";

const VisitHead = ({ v, onEdit, canEdit, testid, section }) => (
  <div className="mb-2 flex items-start justify-between gap-2">
    <p className="text-xs font-semibold text-primary">{fmtDateTime(v.date)} · {v.worker} · {v.type}</p>
    {canEdit && onEdit && (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-primary"
        onClick={() => onEdit(v, section)}
        data-testid={testid || `wb-edit-${v.id}`}
        aria-label="Edit visit"
      >
        <Pencil className="h-4 w-4" />
      </Button>
    )}
  </div>
);

/** 1-based section indexes in WellBabyEncounter. */
export const WB_SECTIONS = {
  delivery: 1,
  complaints: 2,
  allergy: 3,
  growth: 4,
  immunization: 5,
  milestones: 6,
  notes: 7,
  drugs: 8,
  lab: 9,
};

const VaccineBoxes = ({ vaccines, records, dob, testidPrefix = "wb-dash-vac" }) => (
  <ImmunizationDashCards
    vaccines={vaccines}
    records={records}
    getDue={(item) => immunizationDueFromDob(item, dob)}
    getOverdue={(item, rec) => isVaccineOverdue(item, rec, dob)}
    testidPrefix={testidPrefix}
  />
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
  const drugVisits = visits.filter((v) => (v.data?.drugs || []).length);
  const labRowFilled = (row) => !!(row?.result || row?.analyte || row?.sentToLab);
  const labVisits = visits
    .map((v) => ({ ...v, data: { ...v.data, lab: (v.data?.lab || []).filter(labRowFilled) } }))
    .filter((v) => v.data.lab.length > 0);
  const editVisit = immunVisits[0] || visits[0];

  return (
    <div className="space-y-4" data-testid="wb-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-secondary px-4 py-3">
        <div><p className="font-semibold">Well Baby record · {visits.length} visit{visits.length === 1 ? "" : "s"}</p><p className="mt-0.5 text-xs font-medium text-secondary-foreground/80">Current age {ageMonthsToLabel(ageMonths)} · DOB {dob ? fmtDate(dob) : "—"}</p></div>
        {canEdit && <Button className="h-10" onClick={onAddVisit} data-testid="wb-add-visit"><Plus className="mr-1 h-4 w-4" /> Well baby visit</Button>}
      </div>

      {allergyAll.length > 0 && <AlertPanel level="review" title="Allergies" testid="wb-allergy-banner">{allergyAll.join(" · ")}</AlertPanel>}

      <FeatureCard title="Growth chart" count={growthVisits.length || undefined} lastAt={growthVisits[0] ? fmtDateTime(growthVisits[0].date) : undefined} testid="wb-feat-growth">
        {growthVisits[0] && <VisitHead v={growthVisits[0]} onEdit={onEdit} canEdit={canEdit} section={WB_SECTIONS.growth} testid={`wb-growth-edit-${growthVisits[0].id}`} />}
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
                <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} section={WB_SECTIONS.immunization} testid={`wb-immun-edit-${v.id}`} />
                <VaccineBoxes vaccines={vaccines} records={records} dob={dob} testidPrefix={`wb-dash-vac-${v.id}`} />
              </div>
            );
          })
        ) : (
          <div data-testid="wb-immun-entry-empty">
            {editVisit && <VisitHead v={editVisit} onEdit={onEdit} canEdit={canEdit} section={WB_SECTIONS.immunization} testid={`wb-immun-edit-${editVisit.id}`} />}
            <VaccineBoxes vaccines={schedule.vaccines} records={mergedImmun} dob={dob} />
          </div>
        )}
      </FeatureCard>

      <FeatureCard title="Gross motor milestones" count={msVisits.length || Object.keys(mergedMs).length} lastAt={msVisits[0] ? fmtDateTime(msVisits[0].date) : undefined} testid="wb-feat-milestones">
        {(msVisits[0] || visits[0]) && <VisitHead v={msVisits[0] || visits[0]} onEdit={onEdit} canEdit={canEdit} section={WB_SECTIONS.milestones} testid="wb-ms-edit" />}
        <MilestoneChart records={mergedMs} dob={dob} ageMonths={ageMonths} readOnly testid="wb-dash-milestones" />
      </FeatureCard>

      {complaintVisits.length > 0 && (
        <FeatureCard title="Chief complaints" count={complaintVisits.length} lastAt={fmtDateTime(complaintVisits[0].date)} testid="wb-feat-complaints">
          {complaintVisits.map((v) => (
            <div key={v.id} className="border-b border-border/60 py-2 last:border-0">
              <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} section={WB_SECTIONS.complaints} testid={`wb-complaint-edit-${v.id}`} />
              <p className="text-sm font-medium">{v.data.complaints.join(" · ")}</p>
            </div>
          ))}
        </FeatureCard>
      )}

      {drugVisits.length > 0 && (
        <FeatureCard title="Medications" count={drugVisits.reduce((n, v) => n + (v.data?.drugs?.length || 0), 0)} lastAt={fmtDateTime(drugVisits[0].date)} testid="wb-feat-drugs">
          <div className="space-y-4">
            {drugVisits.map((v) => {
              const rows = medicationRows(v, WELLBABY_DRUG_META);
              return (
                <div key={v.id} data-testid={`wb-meds-visit-${v.id}`}>
                  <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} section={WB_SECTIONS.drugs} testid={`wb-drug-edit-${v.id}`} />
                  <div className="overflow-x-auto" data-testid={`wb-meds-table-${v.id}`}>
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground">
                          <th className="py-2 pr-3 font-semibold">Name</th>
                          <th className="py-2 pr-3 font-semibold">Dosage</th>
                          <th className="py-2 pr-3 font-semibold">Frequency</th>
                          <th className="py-2 pr-3 font-semibold">Duration</th>
                          <th className="py-2 font-semibold">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <Fragment key={`${row.name}-${i}`}>
                            <tr className="border-b border-border/70 align-top">
                              <td className="py-2 pr-3 font-medium">{row.name}</td>
                              <td className="py-2 pr-3">{row.dosage}</td>
                              <td className="py-2 pr-3">{row.frequency}</td>
                              <td className="py-2 pr-3">{row.duration}</td>
                              <td className="py-2 whitespace-nowrap">{row.date ? fmtDate(row.date) : "—"}</td>
                            </tr>
                            {row.advice ? (
                              <tr className="border-b border-border/40">
                                <td colSpan={5} className="pb-2 text-xs text-muted-foreground">{row.advice}</td>
                              </tr>
                            ) : null}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </FeatureCard>
      )}

      {labVisits.length > 0 && (
        <FeatureCard title="Laboratory" count={labVisits.reduce((n, v) => n + v.data.lab.length, 0)} lastAt={fmtDateTime(labVisits[0].date)} testid="wb-feat-lab">
          <div className="space-y-4">
            {labVisits.map((v) => (
              <div key={v.id} data-testid={`wb-lab-visit-${v.id}`}>
                <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} section={WB_SECTIONS.lab} testid={`wb-lab-edit-${v.id}`} />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="py-1.5 pr-3 font-semibold">Test</th>
                        <th className="py-1.5 pr-3 font-semibold">Result</th>
                        <th className="py-1.5 pr-3 font-semibold">Value</th>
                        <th className="py-1.5 pr-3 font-semibold">Location</th>
                        <th className="py-1.5 font-semibold">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {v.data.lab.map((row, i) => (
                        <tr key={i} className="border-b border-border/60 last:border-0">
                          <td className="py-1.5 pr-3 font-medium">{row.test}</td>
                          <td className="py-1.5 pr-3">{row.result || (row.sentToLab ? "Sent" : "—")}</td>
                          <td className="py-1.5 pr-3 tabular-nums">{row.analyte || "—"}</td>
                          <td className="py-1.5 pr-3 text-muted-foreground">
                            {row.location || "—"}
                            {row.sentToLab ? " · sent" : ""}
                          </td>
                          <td className="py-1.5 whitespace-nowrap text-muted-foreground">{row.date ? fmtDate(row.date) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </FeatureCard>
      )}

      {noteVisits.length > 0 && (
        <FeatureCard title="Visit notes" count={noteVisits.length} lastAt={fmtDateTime(noteVisits[0].date)} testid="wb-feat-notes">
          {noteVisits.map((v) => (
            <div key={v.id} className="border-b border-border/60 py-2 last:border-0">
              <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} section={WB_SECTIONS.notes} testid={`wb-note-edit-${v.id}`} />
              {(v.data.notes || []).filter((n) => String(n).trim()).map((n, i) => <p key={i} className="mt-1 whitespace-pre-line text-sm">{n}</p>)}
            </div>
          ))}
        </FeatureCard>
      )}
    </div>
  );
}
