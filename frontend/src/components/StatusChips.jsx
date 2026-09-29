import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { DISEASE_SPECS } from "@/mock/specs";
import { DISEASES } from "@/mock/data";
import { isLostToFollowUp } from "@/components/Capture";
import { ANTENATAL_ID, ANTENATAL_NAME, isAncEpisodeClosed, ancStatusColor, ancRiskLevel, autoRiskFactors } from "@/mock/antenatal";
import {
  MAL_ID, MAL_NAME, malDisplayStatus, malStatusColor, malColorGrade, malWeeksVisited,
} from "@/mock/malnutrition";
import { WELLBABY_ID, WELLBABY_NAME } from "@/mock/wellbaby";

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

const outcomeChipCls = (outcome, colorHint) => {
  const c = colorHint || "";
  if (c === "red" || /maternal death|death|died/i.test(outcome || "")) return `${chipCls} border-red-300 bg-red-50 text-red-700`;
  if (c === "amber" || /lost to follow/i.test(outcome || "")) return `${chipCls} border-amber-300 bg-amber-50 text-amber-900`;
  if (c === "primary" || /discharged|recovered|transferred/i.test(outcome || "")) return `${chipCls} border-primary/40 bg-secondary text-primary`;
  if (c === "green" || /active|open/i.test(outcome || "")) return `${chipCls} border-green-300 bg-green-50 text-green-700`;
  return `${chipCls} border-border bg-white`;
};

const riskChipCls = (level) => {
  if (level === "high" || level === "red") return `${chipCls} border-red-300 bg-red-50 text-red-700`;
  if (level === "elevated" || level === "amber") return `${chipCls} border-amber-300 bg-amber-50 text-amber-900`;
  return `${chipCls} border-border bg-white text-muted-foreground`;
};

/** One chip group per disease the patient has a record for (encounters, diseaseStatuses, or patient.diseases). */
export function patientStatusRecords(p, encounters, settings) {
  const encs = (encounters || []).filter((e) => e.patientId === p.id);
  const latestByDisease = new Map();
  for (const e of encs) {
    if (!e.disease) continue;
    if (!DISEASE_SPECS[e.disease] && e.disease !== ANTENATAL_ID && e.disease !== MAL_ID && e.disease !== WELLBABY_ID) continue;
    const prev = latestByDisease.get(e.disease);
    if (!prev || String(e.date).localeCompare(String(prev.date)) > 0) latestByDisease.set(e.disease, e);
  }
  const statusByDisease = new Map();
  for (const s of p.diseaseStatuses || []) {
    const id = String(s?.diseaseId || "").toLowerCase();
    if (!id) continue;
    if (!DISEASE_SPECS[id] && id !== ANTENATAL_ID && id !== MAL_ID && id !== WELLBABY_ID) continue;
    statusByDisease.set(id, s);
  }
  const ids = DISEASES.map((d) => d.id).filter(
    (id) => latestByDisease.has(id) || statusByDisease.has(id) || (p.diseases || []).includes(id)
  );
  if (latestByDisease.has(ANTENATAL_ID) || statusByDisease.has(ANTENATAL_ID) || (p.diseases || []).includes(ANTENATAL_ID) || (p.conditions || []).includes(ANTENATAL_ID)) {
    if (!ids.includes(ANTENATAL_ID)) ids.push(ANTENATAL_ID);
  }
  if (latestByDisease.has(MAL_ID) || statusByDisease.has(MAL_ID) || (p.diseases || []).includes(MAL_ID) || (p.conditions || []).includes(MAL_ID)) {
    if (!ids.includes(MAL_ID)) ids.push(MAL_ID);
  }
  if (latestByDisease.has(WELLBABY_ID) || statusByDisease.has(WELLBABY_ID) || (p.diseases || []).includes(WELLBABY_ID) || (p.conditions || []).includes(WELLBABY_ID)) {
    if (!ids.includes(WELLBABY_ID)) ids.push(WELLBABY_ID);
  }
  if (!ids.length && encs.length) {
    const last = [...encs].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    if (last?.disease) ids.push(last.disease);
  }
  const lastOverall = [...encs].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  const ltfu = isLostToFollowUp(p, encounters, settings);
  const patientDisease = EPISODE_PREFIX[String(p.episodeId || "").split("-")[0]] || (p.diseases || [])[0];

  return ids.map((diseaseId) => {
    const last = latestByDisease.get(diseaseId);
    const persisted = statusByDisease.get(diseaseId);

    if (diseaseId === ANTENATAL_ID) {
      const status =
        real(last?.outcome) ||
        real(last?.data?.outcome?.status) ||
        real(persisted?.outcome) ||
        "Active";
      const closed = isAncEpisodeClosed(status);
      const displayStatus = closed ? status : "Active";
      const risks = last?.data?.history?.riskFactors?.length
        ? last.data.history.riskFactors
        : autoRiskFactors(last?.data || {}, p);
      const riskLevel = ancRiskLevel(risks);
      return {
        diseaseId,
        diseaseName: ANTENATAL_NAME,
        diagnosis: real(last?.diagnosis) || real(persisted?.diagnosis),
        outcome: displayStatus,
        statusColor: ancStatusColor(displayStatus),
        riskFactors: risks,
        riskLevel,
      };
    }
    if (diseaseId === MAL_ID) {
      const malVisits = encs.filter((e) => e.disease === MAL_ID).sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const status = malDisplayStatus(malVisits) || real(persisted?.outcome);
      const admission = malVisits.find((v) => /admission/i.test(v.data?.visitType || v.type || "")) || malVisits[0];
      const type = real(admission?.data?.caseDetails?.admissionType) || real(last?.diagnosis) || real(persisted?.diagnosis);
      const grade = malColorGrade(type);
      const weeks = malWeeksVisited(malVisits);
      return {
        diseaseId,
        diseaseName: MAL_NAME,
        diagnosis: type,
        outcome: status,
        statusColor: malStatusColor(status),
        malGrade: grade,
        malWeeks: weeks,
        malLastDate: last?.date,
      };
    }
    if (diseaseId === WELLBABY_ID) {
      return {
        diseaseId,
        diseaseName: WELLBABY_NAME,
        diagnosis: real(last?.diagnosis) || real(persisted?.diagnosis),
        outcome: real(last?.outcome) || real(persisted?.outcome) || "Active",
      };
    }

    const fromEncDiagnosis = real(last?.diagnosis) || real(last?.data?.diagnosis);
    const fromEncOutcome = real(last?.outcome) || real(last?.data?.outcome);
    const fromPersistedDiagnosis = real(persisted?.diagnosis);
    const fromPersistedOutcome = real(persisted?.outcome);
    const encIsPlaceholder = !fromEncDiagnosis && (!fromEncOutcome || /^(open|active)$/i.test(fromEncOutcome));
    const persistedIsClinical =
      Boolean(fromPersistedDiagnosis) ||
      (Boolean(fromPersistedOutcome) && !/^(open|active)$/i.test(fromPersistedOutcome));
    const diagnosis =
      (!encIsPlaceholder && fromEncDiagnosis) ||
      fromPersistedDiagnosis ||
      fromEncDiagnosis;
    let outcome =
      (!encIsPlaceholder && fromEncOutcome) ||
      (persistedIsClinical ? fromPersistedOutcome : "") ||
      fromEncOutcome ||
      fromPersistedOutcome;
    if (diseaseId === patientDisease && real(p.outcome)) outcome = real(p.outcome);
    if (!outcome && (p.diseases || []).includes(diseaseId) && !last && !persisted) outcome = "Open";
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

function ChipGroup({ diseaseId, diseaseName, diagnosis, outcome, statusColor, riskFactors, riskLevel, malGrade }) {
  const disease = diseaseName || DISEASE_SPECS[diseaseId]?.name || diseaseId;
  const dx = real(diagnosis);
  const out = real(
    outcome && typeof outcome === "object" ? outcome.status || outcome.outcome || "" : outcome
  );
  if (!disease && !dx && !out) return null;
  const isAncOrMal = diseaseId === ANTENATAL_ID || diseaseId === MAL_ID;
  return (
    <>
      {disease && (
        <Badge className={`${chipCls} ${isAncOrMal ? "bg-primary text-white" : diseaseChipClass(diseaseId)}`}>
          {disease}
        </Badge>
      )}
      {dx && (
        <Badge
          variant="outline"
          className={diseaseId === MAL_ID && malGrade?.level ? outcomeChipCls(dx, malGrade.level) : chipCls}
          data-testid={diseaseId === MAL_ID ? "mal-type-chip" : undefined}
        >
          {dx}{diseaseId === MAL_ID && malGrade?.label ? ` · ${malGrade.label}` : ""}
        </Badge>
      )}
      {out && (
        <Badge
          variant="outline"
          className={isAncOrMal ? outcomeChipCls(out, statusColor) : chipCls}
          data-testid={diseaseId === ANTENATAL_ID ? "anc-status-chip" : diseaseId === MAL_ID ? "mal-status-chip" : undefined}
        >
          {out}
        </Badge>
      )}
      {diseaseId === ANTENATAL_ID && riskLevel && riskLevel !== "none" && (
        <Badge variant="outline" className={riskChipCls(riskLevel)} data-testid="anc-risk-chip" title={(riskFactors || []).join(", ")}>
          Risk{riskFactors?.length ? ` · ${riskFactors.length}` : ""}
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
          <ChipGroup {...r} />
        </Fragment>
      ))}
    </div>
  );
}
