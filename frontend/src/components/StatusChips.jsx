import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { DISEASE_SPECS } from "@/mock/specs";
import { DISEASES } from "@/mock/data";
import { isLostToFollowUp } from "@/components/Capture";

const chipCls = "shrink-0 rounded px-2 py-0.5 text-[11px] font-bold";
const EPISODE_PREFIX = { SCAB: "scabies", YAWS: "yaws", LF: "lf", BURU: "buruli", LEP: "leprosy" };

/** Distinct filled chip colours per condition (Patients + Appointments lists). */
export const DISEASE_CHIP_CLASS = {
  scabies: "border-transparent bg-amber-600 text-white",
  yaws: "border-transparent bg-teal-600 text-white",
  buruli: "border-transparent bg-rose-600 text-white",
  lf: "border-transparent bg-sky-700 text-white",
  leprosy: "border-transparent bg-emerald-700 text-white",
  antenatal: "border-transparent bg-fuchsia-700 text-white",
  malnutrition: "border-transparent bg-orange-700 text-white",
  wellbaby: "border-transparent bg-cyan-700 text-white",
};

export function diseaseChipClass(diseaseId) {
  return DISEASE_CHIP_CLASS[diseaseId] || "border-transparent bg-primary text-white";
}

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
    // Disease known from patient.diseases (list API) but encounters not loaded yet — show Open.
    if (!outcome && (p.diseases || []).includes(diseaseId) && !last) outcome = "Open";
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

const hasMeaningfulData = (data) => {
  if (!data || typeof data !== "object") return false;
  return Object.keys(data).some((k) => {
    const v = data[k];
    if (v == null || v === "") return false;
    if (typeof v === "object") {
      if (Array.isArray(v)) return v.length > 0;
      return Object.keys(v).length > 0;
    }
    return true;
  });
};

/** Appointment encounter workflow status: New → In progress → Completed */
export function appointmentEncounterStatus(e) {
  if (!e) return "New";
  const completed =
    e.complete === true ||
    e.pendingStart === false ||
    String(e.status || "").toLowerCase() === "complete" ||
    String(e.status || "").toLowerCase() === "completed";
  if (completed) return "Completed";

  const inProgressHint = /in\s*progress/i.test(String(e.status || ""));
  const hasDraft =
    inProgressHint ||
    e.revised === true ||
    (Array.isArray(e.editedSections) && e.editedSections.length > 0) ||
    hasMeaningfulData(e.data);

  if (hasDraft) return "In progress";
  return "New";
}

const ENCOUNTER_STATUS_CHIP_CLASS = {
  New: "border-sky-300 bg-sky-50 text-sky-900",
  "In progress": "border-amber-300 bg-amber-50 text-amber-900",
  Completed: "border-emerald-300 bg-emerald-50 text-emerald-900",
};

export function EncounterStatusChip({ encounter, status: statusProp, testid }) {
  const status = statusProp || appointmentEncounterStatus(encounter);
  return (
    <Badge
      variant="outline"
      className={`${chipCls} ${ENCOUNTER_STATUS_CHIP_CLASS[status] || ENCOUNTER_STATUS_CHIP_CLASS.New}`}
      data-testid={testid}
    >
      {status}
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
      {disease && (
        <Badge className={`${chipCls} ${diseaseChipClass(diseaseId)}`}>
          {disease}
        </Badge>
      )}
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
