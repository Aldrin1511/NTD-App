import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { DISEASE_SPECS } from "@/mock/specs";
import { DISEASES } from "@/mock/data";
import { isLostToFollowUp } from "@/components/Capture";

const chipCls = "shrink-0 rounded px-2 py-0.5 text-[11px] font-bold";
const EPISODE_PREFIX = { SCAB: "scabies", YAWS: "yaws", LF: "lf", BURU: "buruli", LEP: "leprosy" };

const real = (v) => {
  const s = String(v || "").trim();
  return s && s !== "—" ? s : "";
};

/** One chip group per disease the patient has a record for (encounters or patient.diseases). */
export function patientStatusRecords(p, encounters, settings) {
  const encs = (encounters || []).filter((e) => e.patientId === p.id);
  const latestByDisease = new Map();
  for (const e of encs) {
    if (!e.disease || !DISEASE_SPECS[e.disease]) continue;
    const prev = latestByDisease.get(e.disease);
    if (!prev || String(e.date).localeCompare(String(prev.date)) > 0) latestByDisease.set(e.disease, e);
  }
  const ids = DISEASES.map((d) => d.id).filter((id) => latestByDisease.has(id) || (p.diseases || []).includes(id));
  if (!ids.length && encs.length) {
    const last = [...encs].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    if (last?.disease) ids.push(last.disease);
  }
  const lastOverall = [...encs].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  const ltfu = isLostToFollowUp(p, encounters, settings);
  const patientDisease = EPISODE_PREFIX[String(p.episodeId || "").split("-")[0]] || (p.diseases || [])[0];

  return ids.map((diseaseId) => {
    const last = latestByDisease.get(diseaseId);
    const diagnosis = real(last?.diagnosis) || real(last?.data?.diagnosis);
    let outcome = real(last?.outcome) || real(last?.data?.outcome);
    if (diseaseId === patientDisease && real(p.outcome)) outcome = real(p.outcome);
    if ((!outcome || /^(open|active)$/i.test(outcome)) && ltfu && lastOverall?.disease === diseaseId) {
      outcome = "Lost to follow-up";
    }
    return { diseaseId, diagnosis, outcome };
  });
}

/** Unsynced indicator — place on the right of the row next to action icons */
export function PendingSyncChip({ pending, testid }) {
  if (!pending) return null;
  return (
    <Badge
      variant="outline"
      className={`${chipCls} border-orange-300 bg-orange-50 text-orange-800`}
      data-testid={testid}
    >
      Pending Sync
    </Badge>
  );
}

function ChipGroup({ diseaseId, diagnosis, outcome }) {
  const disease = DISEASE_SPECS[diseaseId]?.name || diseaseId;
  const dx = real(diagnosis);
  const out = real(outcome);
  if (!disease && !dx && !out) return null;
  return (
    <>
      {disease && <Badge className={`${chipCls} bg-primary text-white`}>{disease}</Badge>}
      {dx && (
        <Badge variant="outline" className={chipCls}>
          {dx}
        </Badge>
      )}
      {out && (
        <Badge variant="outline" className={chipCls}>
          {out}
        </Badge>
      )}
    </>
  );
}

/** Disease · Diagnosis (optional) · Outcome (optional). Pass `records` to show every active disease. */
export default function StatusChips({ diseaseId, diagnosis, outcome, records, testid }) {
  const items = (records && records.length ? records : [{ diseaseId, diagnosis, outcome }]).filter(
    (r) => r.diseaseId || real(r.diagnosis) || real(r.outcome)
  );
  if (!items.length) return null;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5" data-testid={testid}>
      {items.map((r, i) => (
        <Fragment key={r.diseaseId || i}>
          {i > 0 && <span className="mx-0.5 hidden h-3 w-px bg-border sm:inline-block" aria-hidden />}
          <ChipGroup diseaseId={r.diseaseId} diagnosis={r.diagnosis} outcome={r.outcome} />
        </Fragment>
      ))}
    </div>
  );
}
