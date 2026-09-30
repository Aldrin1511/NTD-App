import { Fragment, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertPanel } from "@/components/Fields";
import { FeatureCard, ExpandAllButton } from "@/components/EntryKit";
import { GrowthReview } from "@/components/GrowthChart";
import MilestoneChart from "@/components/MilestoneChart";
import { dobFromAge, formatAgeYMD } from "@/components/Capture";
import { fmtDate, fmtDateTime, groupDiseaseEpisodes } from "@/mock/specs";
import { WELLBABY_ID, WELLBABY_NAME, immunizationDueFromDob, isVaccineOverdue, WELLBABY_DRUG_META } from "@/mock/wellbaby";
import { monthsBetween } from "@/mock/growth";
import { ImmunizationDashCards } from "@/components/ImmunizationCards";
import { medicationRows } from "@/components/AntenatalMedications";
import { Pencil, Plus, Printer } from "lucide-react";

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
  newborn: 2,
  complaints: 3,
  allergy: 4,
  growth: 5,
  immunization: 6,
  milestones: 7,
  notes: 8,
  drugs: 9,
  lab: 10,
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

export default function WellBabyDashboard({ patient, encounters, settings, canEdit, onEdit, onAddVisit, onPrint }) {
  const episodes = useMemo(() => groupDiseaseEpisodes(encounters, WELLBABY_ID, null), [encounters]);
  const [featureOpen, setFeatureOpen] = useState({});
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
  const allergyVisits = visits.filter((v) => (v.data?.allergy || []).length);
  const deliveryFilled = (del = {}) => !!(
    del.deliveryDate || del.date || del.mode || del.type || del.place
    || (del.outcome && ["Delivered (Health Centre)", "Delivered (Hospital)", "Delivered (Bush)", "Abortion", "Preterm"].includes(del.outcome))
    || del.complication || del.fetuses || del.familyPlanning || (del.postpartum || []).length
  );
  const newbornFilled = (del = {}) => {
    const babies = del.babies || [];
    if (babies.some((b) => b.sex || b.weightKg || b.lengthCm || b.headCm || b.apgar1 || b.apgar5 || b.apgar10
      || b.resuscitation || (b.complications || []).length || b.outcome || b.deliveryType
      || Object.values(b.physicalExam || {}).some(Boolean))) return true;
    return !!(
      del.weightKg || del.lengthCm || del.headCm || del.apgar1 || del.apgar5 || del.apgar10
      || del.sex || del.resuscitation || (del.complications || []).length || del.deliveryType
      || Object.values(del.physicalExam || {}).some(Boolean)
    );
  };
  const deliveryVisits = visits.filter((v) => deliveryFilled(v.data?.delivery));
  const newbornVisits = visits.filter((v) => newbornFilled(v.data?.delivery));
  const noteVisits = visits.filter((v) => (v.data?.notes || []).some((n) => String(n).trim()));
  const drugVisits = visits.filter((v) => (v.data?.drugs || []).length);
  const labRowFilled = (row) => !!(row?.result || row?.analyte || row?.sentToLab);
  const labVisits = visits
    .map((v) => ({ ...v, data: { ...v.data, lab: (v.data?.lab || []).filter(labRowFilled) } }))
    .filter((v) => v.data.lab.length > 0);
  const editVisit = immunVisits[0] || visits[0];

  const deliverySummary = (del = {}) =>
    [
      del.deliveryDate || del.date ? fmtDate(del.deliveryDate || del.date) : null,
      del.mode || del.type || null,
      del.complication && del.complication !== "None" ? del.complication : null,
      del.fetuses ? `${del.fetuses} fetus${String(del.fetuses) === "1" ? "" : "es"}` : null,
      del.familyPlanning && del.familyPlanning !== "None" ? `FP: ${del.familyPlanning}` : null,
      (del.postpartum || []).length ? del.postpartum.join(", ") : null,
      del.place || del.outcome || null,
    ]
      .filter(Boolean)
      .join(" · ") || "—";

  const primaryBaby = (del = {}) =>
    (del.babies || []).find((b) => b.patientId) || (del.babies || [])[0] || del;

  const newbornSummary = (del = {}) => {
    const b = primaryBaby(del);
    return [
      b.sex || null,
      b.weightKg ? `${b.weightKg} kg` : null,
      b.lengthCm ? `${b.lengthCm} cm` : null,
      b.headCm ? `HC ${b.headCm} cm` : null,
      b.apgar1 || b.apgar5 || b.apgar10
        ? `APGAR ${b.apgar1 || "—"}/${b.apgar5 || "—"}${b.apgar10 ? `/${b.apgar10}` : ""}`
        : null,
      b.resuscitation ? `Resusc: ${b.resuscitation}` : null,
      (b.complications || []).length ? b.complications.join(", ") : null,
      b.outcome || null,
    ]
      .filter(Boolean)
      .join(" · ") || "—";
  };

  const featureKeys = [
    deliveryVisits.length > 0 && "delivery",
    newbornVisits.length > 0 && "newborn",
    "growth",
    "immunization",
    "milestones",
    complaintVisits.length > 0 && "complaints",
    allergyVisits.length > 0 && "allergy",
    drugVisits.length > 0 && "drugs",
    labVisits.length > 0 && "lab",
    noteVisits.length > 0 && "notes",
  ].filter(Boolean);
  const allExpanded = featureKeys.length > 0 && featureKeys.every((k) => featureOpen[k] !== false);
  const cardOpen = (k) => featureOpen[k] !== false;
  const setCardOpen = (k) => (next) => setFeatureOpen((o) => ({ ...o, [k]: next }));

  return (
    <div className="space-y-4" data-testid="wb-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-secondary px-4 py-3">
        <div><p className="font-semibold">Well Baby record · {visits.length} visit{visits.length === 1 ? "" : "s"}</p><p className="mt-0.5 text-xs font-medium text-secondary-foreground/80">Current age {formatAgeYMD(dob) || "—"} · DOB {dob ? fmtDate(dob) : "—"}</p></div>
        <div className="flex shrink-0 items-center gap-2">
          <ExpandAllButton
            allExpanded={allExpanded}
            onToggle={() => setFeatureOpen(Object.fromEntries(featureKeys.map((k) => [k, !allExpanded])))}
            testid="wb-toggle-all-features-btn"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-white/70 text-primary hover:bg-white"
          />
          {onPrint && (
            <Button
              type="button"
              variant="outline"
              className="h-10 shrink-0 bg-white/70"
              disabled={!visits.length}
              data-testid="wb-print-visit-summary"
              title={visits.length ? "Print visit summary" : "No visits to print"}
              onClick={() =>
                onPrint({
                  diseaseName: WELLBABY_NAME,
                  episode,
                  visits,
                  caption: `Well Baby record · ${visits.length} visit${visits.length === 1 ? "" : "s"}`,
                  dates: `Current age ${formatAgeYMD(dob) || "—"} · DOB ${dob ? fmtDate(dob) : "—"}`,
                })
              }
            >
              <Printer className="mr-1 h-4 w-4" /> Print
            </Button>
          )}
          {canEdit && <Button className="h-10" onClick={onAddVisit} data-testid="wb-add-visit"><Plus className="mr-1 h-4 w-4" /> Well baby visit</Button>}
        </div>
      </div>

      {deliveryVisits.length > 0 && (
        <FeatureCard title="Delivery details" count={deliveryVisits.length} lastAt={fmtDateTime(deliveryVisits[0].date)} testid="wb-feat-delivery" open={cardOpen("delivery")} onOpenChange={setCardOpen("delivery")}>
          {deliveryVisits.map((v) => (
            <div key={v.id} className="border-b border-border/60 py-2 last:border-0" data-testid={`wb-delivery-visit-${v.id}`}>
              <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} section={WB_SECTIONS.delivery} testid={`wb-delivery-edit-${v.id}`} />
              <p className="text-sm text-muted-foreground">{deliverySummary(v.data?.delivery)}</p>
            </div>
          ))}
        </FeatureCard>
      )}

      {newbornVisits.length > 0 && (
        <FeatureCard title="New born details" count={newbornVisits.length} lastAt={fmtDateTime(newbornVisits[0].date)} testid="wb-feat-newborn" open={cardOpen("newborn")} onOpenChange={setCardOpen("newborn")}>
          {newbornVisits.map((v) => (
            <div key={v.id} className="border-b border-border/60 py-2 last:border-0" data-testid={`wb-newborn-visit-${v.id}`}>
              <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} section={WB_SECTIONS.newborn} testid={`wb-newborn-edit-${v.id}`} />
              <p className="text-sm text-muted-foreground">{newbornSummary(v.data?.delivery)}</p>
            </div>
          ))}
        </FeatureCard>
      )}

      <FeatureCard title="Growth chart" count={growthVisits.length || undefined} lastAt={growthVisits[0] ? fmtDateTime(growthVisits[0].date) : undefined} testid="wb-feat-growth" open={cardOpen("growth")} onOpenChange={setCardOpen("growth")}>
        {growthVisits[0] && <VisitHead v={growthVisits[0]} onEdit={onEdit} canEdit={canEdit} section={WB_SECTIONS.growth} testid={`wb-growth-edit-${growthVisits[0].id}`} />}
        <GrowthReview sex={patient.sex || patient.gender} dob={dob} entries={growthEntries} testid="wb-growth-review" />
      </FeatureCard>

      <FeatureCard title="Immunization" count={immunVisits.length || Object.keys(mergedImmun).length} lastAt={editVisit ? fmtDateTime(editVisit.date) : undefined} testid="wb-feat-immunization" open={cardOpen("immunization")} onOpenChange={setCardOpen("immunization")}>
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

      <FeatureCard title="Gross motor milestones" count={msVisits.length || Object.keys(mergedMs).length} lastAt={msVisits[0] ? fmtDateTime(msVisits[0].date) : undefined} testid="wb-feat-milestones" open={cardOpen("milestones")} onOpenChange={setCardOpen("milestones")}>
        {(msVisits[0] || visits[0]) && <VisitHead v={msVisits[0] || visits[0]} onEdit={onEdit} canEdit={canEdit} section={WB_SECTIONS.milestones} testid="wb-ms-edit" />}
        <MilestoneChart records={mergedMs} dob={dob} ageMonths={ageMonths} readOnly testid="wb-dash-milestones" />
      </FeatureCard>

      {complaintVisits.length > 0 && (
        <FeatureCard title="Chief complaints" count={complaintVisits.length} lastAt={fmtDateTime(complaintVisits[0].date)} testid="wb-feat-complaints" open={cardOpen("complaints")} onOpenChange={setCardOpen("complaints")}>
          {complaintVisits.map((v) => (
            <div key={v.id} className="border-b border-border/60 py-2 last:border-0">
              <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} section={WB_SECTIONS.complaints} testid={`wb-complaint-edit-${v.id}`} />
              <p className="text-sm font-medium">{v.data.complaints.join(" · ")}</p>
            </div>
          ))}
        </FeatureCard>
      )}

      {allergyVisits.length > 0 && (
        <FeatureCard title="Allergy" count={allergyVisits.length} lastAt={fmtDateTime(allergyVisits[0].date)} testid="wb-feat-allergy" open={cardOpen("allergy")} onOpenChange={setCardOpen("allergy")}>
          {allergyVisits.map((v) => (
            <div key={v.id} className="border-b border-border/60 py-2 last:border-0" data-testid={`wb-allergy-visit-${v.id}`}>
              <VisitHead v={v} onEdit={onEdit} canEdit={canEdit} section={WB_SECTIONS.allergy} testid={`wb-allergy-edit-${v.id}`} />
              <p className="text-sm text-muted-foreground">{(v.data.allergy || []).join(" · ") || "—"}</p>
            </div>
          ))}
        </FeatureCard>
      )}

      {drugVisits.length > 0 && (
        <FeatureCard title="Medications" count={drugVisits.reduce((n, v) => n + (v.data?.drugs?.length || 0), 0)} lastAt={fmtDateTime(drugVisits[0].date)} testid="wb-feat-drugs" open={cardOpen("drugs")} onOpenChange={setCardOpen("drugs")}>
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
                          <th className="py-2 font-semibold">Qualifier</th>
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
                              <td className="py-2">{row.qualifier || "—"}</td>
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
        <FeatureCard title="Laboratory" count={labVisits.reduce((n, v) => n + v.data.lab.length, 0)} lastAt={fmtDateTime(labVisits[0].date)} testid="wb-feat-lab" open={cardOpen("lab")} onOpenChange={setCardOpen("lab")}>
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
                        <th className="py-1.5 font-semibold">Completed date</th>
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
        <FeatureCard title="Visit notes" count={noteVisits.length} lastAt={fmtDateTime(noteVisits[0].date)} testid="wb-feat-notes" open={cardOpen("notes")} onOpenChange={setCardOpen("notes")}>
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
