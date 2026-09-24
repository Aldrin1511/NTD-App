import { Avatar, dobFromAge, patientAgeLabel } from "@/components/Capture";
import { Button } from "@/components/ui/button";
import { fmtDate, DISEASE_SPECS } from "@/mock/specs";
import { scabiesTreatmentSummary } from "@/components/ScabiesMedications";
import { yawsTreatmentSummary } from "@/components/YawsMedications";
import { lfTreatmentSummary } from "@/components/LfMedications";
import { buruliTreatmentSummary } from "@/components/BuruliMedications";
import { leprosyTreatmentSummary } from "@/components/LeprosyMedications";
import { ANTENATAL_ID, ancRiskLevel, autoRiskFactors } from "@/mock/antenatal";
import {
  MAL_ID, malDisplayStatus, malColorGrade, malWeeksVisited, malLastVisitLabel,
} from "@/mock/malnutrition";
import { PanelLeftClose, Pencil } from "lucide-react";

export default function PatientSidebar({
  patient: p,
  encounters = [],
  diseases = [],
  onCollapse,
  onEdit,
  testid = "lhs-panel",
}) {
  const last = [...encounters].sort((a, b) => b.date.localeCompare(a.date))[0];
  const real = (v) => {
    if (v == null) return "";
    const s = String(v).trim();
    return s && s !== "—" ? s : "";
  };
  const lastWithTx = [...encounters]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((e) => real(e.treatment) || (e.data?.topical || []).length || (e.data?.oral || []).length);
  const lastTreatment =
    real(lastWithTx?.treatment) ||
    (lastWithTx?.disease === "scabies"
      ? scabiesTreatmentSummary(lastWithTx?.data || {})
      : lastWithTx?.disease === "yaws"
        ? yawsTreatmentSummary(lastWithTx?.data || {})
        : lastWithTx?.disease === "lf"
          ? lfTreatmentSummary(lastWithTx?.data || {})
          : lastWithTx?.disease === "buruli"
            ? buruliTreatmentSummary(lastWithTx?.data || {})
            : lastWithTx?.disease === "leprosy"
              ? leprosyTreatmentSummary(lastWithTx?.data || {})
              : "") ||
    [...(lastWithTx?.data?.topical || []), ...(lastWithTx?.data?.oral || [])].join(" + ") ||
    "—";
  const diseaseNames = diseases
    .map((d) => (typeof d === "string" ? DISEASE_SPECS[d]?.name || d : d.name))
    .filter(Boolean);

  const ancEnc = [...encounters]
    .filter((e) => e.disease === ANTENATAL_ID)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  const ancRisks = ancEnc?.data?.history?.riskFactors?.length
    ? ancEnc.data.history.riskFactors
    : autoRiskFactors(ancEnc?.data || {}, p);
  const ancRisk = ancRiskLevel(ancRisks);

  const malVisits = [...encounters]
    .filter((e) => e.disease === MAL_ID)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const malAdmission = malVisits.find((v) => /admission/i.test(v.data?.visitType || v.type || "")) || malVisits[0];
  const malType = real(malAdmission?.data?.caseDetails?.admissionType);
  const malGrade = malColorGrade(malType);
  const malStatus = malVisits.length ? malDisplayStatus(malVisits) : "";
  const malWeeks = malWeeksVisited(malVisits);
  const malLast = malVisits.length ? malLastVisitLabel(malVisits, fmtDate) : "";

  return (
    <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start" data-testid={testid}>
      <section className="rounded-lg border border-border bg-white p-4">
        <div className="flex items-start gap-3">
          <Avatar patient={p} size="h-16 w-16" testid={`${testid}-photo`} />
          <div className="min-w-0 flex-1">
            <p className="font-head text-lg font-bold leading-tight">{p.name}</p>
            <p className="text-xs text-muted-foreground">{p.id}</p>
          </div>
          <div className="flex shrink-0 items-start gap-1">
            {onEdit && (
              <Button variant="ghost" size="icon" className="h-9 w-9 text-primary" data-testid={`${testid}-edit-btn`} onClick={onEdit} title="Edit patient details">
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {onCollapse && (
              <Button variant="ghost" size="icon" className="h-9 w-9" data-testid="lhs-collapse-btn" onClick={onCollapse}>
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <dl className="mt-3 space-y-1.5 text-sm">
          {[
            ["Date of Birth", fmtDate(p.dob || dobFromAge(p.age, p.createdAt))],
            ["Age", patientAgeLabel(p)],
            ["Gender", p.gender || p.sex || "—"],
            ["Blood", p.bloodGroup || "Unknown"],
            ["Phone", p.phone || "—"],
            ["Village", `${p.village}, ${p.district}`],
            ["Province", p.province],
            ["Consent", p.consent || "By verbal"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-border pb-1 last:border-0">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="text-right font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="rounded-lg border border-border bg-white p-4" data-testid="clinical-ready-reckoner">
        <p className="text-xs font-semibold text-muted-foreground">Clinical summary</p>
        <p className="mt-2 text-sm">
          <b>Last encounter:</b>{" "}
          {malLast || (last ? fmtDate(last.date) : "—")}
          {!malLast && malWeeks > 0 ? ` (${malWeeks} week${malWeeks === 1 ? "" : "s"})` : ""}
        </p>
        <p className="mt-1 text-sm">
          <b>Active drugs:</b> {lastTreatment}
        </p>
        <p className="mt-1 text-sm">
          <b>Conditions:</b> {diseaseNames.join(", ") || "None"}
        </p>
        {ancRisks.length > 0 && (
          <p className="mt-1 text-sm">
            <b>ANC risk:</b>{" "}
            <span className={ancRisk === "high" ? "font-semibold text-red-700" : "font-semibold text-amber-800"}>{ancRisks.join(" · ")}</span>
          </p>
        )}
        {malType && (
          <p className="mt-1 text-sm" data-testid="mal-sidebar-summary">
            <b>Malnutrition:</b>{" "}
            <span className={malGrade.level === "red" ? "font-semibold text-red-700" : malGrade.level === "amber" ? "font-semibold text-amber-800" : "font-semibold"}>
              {malType}{malGrade.label ? ` · ${malGrade.label}` : ""} · {malStatus}
            </span>
          </p>
        )}
      </section>
    </aside>
  );
}
