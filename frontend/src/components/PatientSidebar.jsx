import { Avatar, dobFromAge } from "@/components/Capture";
import { Button } from "@/components/ui/button";
import { fmtDate, DISEASE_SPECS } from "@/mock/specs";
import { scabiesTreatmentSummary } from "@/components/ScabiesMedications";
import { PanelLeftClose } from "lucide-react";

export default function PatientSidebar({
  patient: p,
  encounters = [],
  diseases = [],
  onCollapse,
  testid = "lhs-panel",
}) {
  const last = [...encounters].sort((a, b) => b.date.localeCompare(a.date))[0];
  const real = (v) => {
    if (v == null) return "";
    const s = String(v).trim();
    return s && s !== "—" ? s : "";
  };
  const lastWithDx = [...encounters]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((e) => real(e.diagnosis) || real(e.data?.diagnosis));
  const lastWithTx = [...encounters]
    .sort((a, b) => b.date.localeCompare(a.date))
    .find((e) => real(e.treatment) || (e.data?.topical || []).length || (e.data?.oral || []).length);
  const lastDiagnosis = real(lastWithDx?.diagnosis) || real(lastWithDx?.data?.diagnosis) || "—";
  const lastTreatment =
    real(lastWithTx?.treatment) ||
    scabiesTreatmentSummary(lastWithTx?.data || {}) ||
    [...(lastWithTx?.data?.topical || []), ...(lastWithTx?.data?.oral || [])].join(" + ") ||
    "—";
  const diseaseNames = diseases.length
    ? diseases.map((d) => (typeof d === "string" ? DISEASE_SPECS[d]?.name || d : d.name)).filter(Boolean)
    : (p.diseases || []).map((id) => DISEASE_SPECS[id]?.name || id);

  return (
    <aside className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start" data-testid={testid}>
      <section className="rounded-lg border border-border bg-white p-4">
        <div className="flex items-start gap-3">
          <Avatar patient={p} size="h-16 w-16" testid={`${testid}-photo`} />
          <div className="min-w-0 flex-1">
            <p className="font-head text-lg font-bold leading-tight">{p.name}</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{p.id}</p>
          </div>
          {onCollapse && (
            <Button variant="ghost" size="icon" className="h-9 w-9" data-testid="lhs-collapse-btn" onClick={onCollapse}>
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>
        <dl className="mt-3 space-y-1.5 text-sm">
          {[
            ["DOB", fmtDate(p.dob || dobFromAge(p.age, p.createdAt))],
            ["Age", `${p.age}y`],
            ["Gender", p.gender || p.sex || "—"],
            ["Blood", p.bloodGroup || "Unknown"],
            ["Weight", `${p.weight} kg`],
            ["Phone", p.phone || "—"],
            ["Village", `${p.village}, ${p.district}`],
            ["Province", p.province],
            ["Consent", p.consent || "By verbal"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-border pb-1 last:border-0">
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">{k}</dt>
              <dd className="text-right font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="rounded-lg border border-border bg-white p-4" data-testid="clinical-ready-reckoner">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Clinical summary</p>
        <p className="mt-2 text-sm">
          <b>Last diagnosis:</b> {lastDiagnosis}
        </p>
        <p className="mt-1 text-sm">
          <b>Active drugs:</b> {lastTreatment}
        </p>
        <p className="mt-1 text-sm">
          <b>Last encounter:</b> {last ? fmtDate(last.date) : "—"}
        </p>
        <p className="mt-1 text-sm">
          <b>Conditions:</b> {diseaseNames.join(", ") || "None"}
        </p>
      </section>
    </aside>
  );
}
