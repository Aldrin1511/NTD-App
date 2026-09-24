import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { DISEASE_SPECS } from "@/mock/specs";
import { DISEASES } from "@/mock/data";
import { isLostToFollowUp } from "@/components/Capture";
import { ANTENATAL_ID, ANTENATAL_NAME, isAncEpisodeClosed, ancStatusColor, ancRiskLevel, autoRiskFactors } from "@/mock/antenatal";
import {
  MAL_ID, MAL_NAME, malDisplayStatus, malStatusColor, malColorGrade, malWeeksVisited,
} from "@/mock/malnutrition";

const chipCls = "shrink-0 rounded px-2 py-0.5 text-[11px] font-bold";
const EPISODE_PREFIX = { SCAB: "scabies", YAWS: "yaws", LF: "lf", BURU: "buruli", LEP: "leprosy" };

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

/** One chip group per disease the patient has a record for (encounters or patient.diseases). */
export function patientStatusRecords(p, encounters, settings) {
  const encs = (encounters || []).filter((e) => e.patientId === p.id);
  const latestByDisease = new Map();
  for (const e of encs) {
    if (!e.disease) continue;
    if (!DISEASE_SPECS[e.disease] && e.disease !== ANTENATAL_ID && e.disease !== MAL_ID) continue;
    const prev = latestByDisease.get(e.disease);
    if (!prev || String(e.date).localeCompare(String(prev.date)) > 0) latestByDisease.set(e.disease, e);
  }
  const ids = DISEASES.map((d) => d.id).filter((id) => latestByDisease.has(id) || (p.diseases || []).includes(id));
  if (latestByDisease.has(ANTENATAL_ID) || (p.diseases || []).includes(ANTENATAL_ID) || (p.conditions || []).includes(ANTENATAL_ID)) {
    if (!ids.includes(ANTENATAL_ID)) ids.push(ANTENATAL_ID);
  }
  if (latestByDisease.has(MAL_ID) || (p.diseases || []).includes(MAL_ID) || (p.conditions || []).includes(MAL_ID)) {
    if (!ids.includes(MAL_ID)) ids.push(MAL_ID);
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
    if (diseaseId === ANTENATAL_ID) {
      const status = real(last?.outcome) || real(last?.data?.outcome?.status) || "Active";
      const closed = isAncEpisodeClosed(status);
      const displayStatus = closed ? status : "Active";
      const risks = last?.data?.history?.riskFactors?.length
        ? last.data.history.riskFactors
        : autoRiskFactors(last?.data || {}, p);
      const riskLevel = ancRiskLevel(risks);
      return {
        diseaseId,
        diseaseName: ANTENATAL_NAME,
        diagnosis: real(last?.diagnosis),
        outcome: displayStatus,
        statusColor: ancStatusColor(displayStatus),
        riskFactors: risks,
        riskLevel,
      };
    }
    if (diseaseId === MAL_ID) {
      const malVisits = encs.filter((e) => e.disease === MAL_ID).sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const status = malDisplayStatus(malVisits);
      const admission = malVisits.find((v) => /admission/i.test(v.data?.visitType || v.type || "")) || malVisits[0];
      const type = real(admission?.data?.caseDetails?.admissionType) || real(last?.diagnosis);
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
    <Badge variant="outline" className={`${chipCls} border-orange-300 bg-orange-50 text-orange-800`} data-testid={testid}>
      Pending Sync
    </Badge>
  );
}

function ChipGroup({ diseaseId, diseaseName, diagnosis, outcome, statusColor, riskFactors, riskLevel, malGrade }) {
  const disease = diseaseName || DISEASE_SPECS[diseaseId]?.name || diseaseId;
  const dx = real(diagnosis);
  const out = real(outcome);
  if (!disease && !dx && !out) return null;
  return (
    <>
      {disease && <Badge className={`${chipCls} bg-primary text-white`}>{disease}</Badge>}
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
          className={outcomeChipCls(out, statusColor)}
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
