import { useMemo } from "react";
import { Check } from "lucide-react";
import { AlertPanel, withDrugCourse } from "@/components/Fields";
import { DosePhysicalBox, DoseUnitSelect, DrugVisitFields } from "@/components/MedicationShared";
import { formatDosePhysical, dropVisitPosology } from "@/lib/medications";

export const BURULI_DRUGS = {
  rifampicin: "Tab Rifampicin 300mg (10mg per Kg)",
  clarithromycin: "Tab Clarithromycin 500mg (7.5mg per kg)",
};

const RIF_OPTIONS = ["150", "300"];
const CLA_OPTIONS = ["250", "500"];

/** WHO Buruli adult maxima. */
const RIF_MAX_MG = 600;
const CLA_MAX_MG_PER_DOSE = 500;

function halfTabs(mg, tabletMg) {
  if (!mg || !tabletMg) return null;
  return Math.round((mg / tabletMg) * 2) / 2;
}

export function rifampicinDose(weight, tabletMg = 300) {
  if (!weight || !tabletMg) return null;
  const raw = weight * 10;
  const mg = Math.min(raw, RIF_MAX_MG);
  return {
    mg,
    tabs: halfTabs(mg, tabletMg),
    tabletMg,
    capped: raw > RIF_MAX_MG,
    schedule: "Once a day for 8 weeks",
  };
}

export function clarithromycinDose(weight, tabletMg = 500) {
  if (!weight || !tabletMg) return null;
  const raw = weight * 7.5;
  const mg = Math.min(raw, CLA_MAX_MG_PER_DOSE);
  return {
    mg,
    tabs: halfTabs(mg, tabletMg),
    tabletMg,
    capped: raw > CLA_MAX_MG_PER_DOSE,
    schedule: "Twice a day for 8 weeks",
  };
}

function DrugCard({ id, title, selected, onToggle, children, subtitle }) {
  return (
    <div
      className={`rounded-lg border p-4 ${selected ? "border-primary bg-secondary/40" : "border-border bg-white"}`}
      data-testid={`buruli-drug-${id}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 text-left"
        data-testid={`buruli-drug-toggle-${id}`}
      >
        <span
          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded border ${
            selected ? "border-primary bg-primary text-white" : "border-input bg-white"
          }`}
        >
          {selected && <Check className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </button>
      {children && <div className="mt-3 space-y-3 border-t border-border/60 pt-3">{children}</div>}
    </div>
  );
}

export default function BuruliMedications({
  oral = [],
  rifampicinTabletMg = 300,
  clarithromycinTabletMg = 500,
  onChange,
  weight = 0,
  medCourses = {},
  posology = {},
}) {
  const selected = useMemo(
    () => ({
      rifampicin: oral.includes(BURULI_DRUGS.rifampicin),
      clarithromycin: oral.includes(BURULI_DRUGS.clarithromycin),
    }),
    [oral],
  );

  const rif = rifampicinDose(weight, Number(rifampicinTabletMg) || 300);
  const cla = clarithromycinDose(weight, Number(clarithromycinTabletMg) || 500);

  const setOral = (name, on) => {
    const next = on ? [...new Set([...oral, name])] : oral.filter((x) => x !== name);
    onChange({
      oral: next,
      medCourses: withDrugCourse(medCourses, name, on),
      posology: on ? posology : dropVisitPosology(posology, name),
    });
  };

  return (
    <div className="space-y-4" data-testid="buruli-medications">
      <p className="text-sm text-muted-foreground">
        Select antibiotics for this visit. Doses use weight (mg/kg) and the available tablet strength you choose.
      </p>

      <AlertPanel level="info" title="Note" testid="buruli-dose-note">
        The dose should be calculated based on the age/weight and available dosage. Course is 8 weeks for both drugs.
      </AlertPanel>

      {/* i. Rifampicin */}
      <DrugCard
        id="rifampicin"
        title={BURULI_DRUGS.rifampicin}
        subtitle="Once a day for 8 weeks · Dose 10 mg per kg (max 600 mg)"
        selected={selected.rifampicin}
        onToggle={() => setOral(BURULI_DRUGS.rifampicin, !selected.rifampicin)}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <DoseUnitSelect
            options={RIF_OPTIONS.map((t) => `${t} mg`)}
            value={`${rifampicinTabletMg || 300} mg`}
            onChange={(v) => onChange({ rifampicinTabletMg: Number(String(v).replace(/\D/g, "")) || 300 })}
            testid="buruli-rifampicin-tablet"
          />
          <DosePhysicalBox
            testid="buruli-rifampicin-dose"
            doseText={rif ? formatDosePhysical(rif.mg, rif.tabs) : ""}
            hint={rif ? `${weight} kg × 10 mg/kg${rif.capped ? " (capped at 600 mg)" : ""} · ${rif.schedule}` : "Enter weight to calculate tablets."}
          />
        </div>
        {selected.rifampicin && (
          <DrugVisitFields
            name={BURULI_DRUGS.rifampicin}
            selected
            medCourses={medCourses}
            posology={posology}
            onChange={onChange}
            defaults={{
              dosage: rif ? formatDosePhysical(rif.mg, rif.tabs) : "10 mg/kg",
              frequency: "Once daily",
              duration: "8 weeks",
            }}
          />
        )}
      </DrugCard>

      {/* ii. Clarithromycin */}
      <DrugCard
        id="clarithromycin"
        title={BURULI_DRUGS.clarithromycin}
        subtitle="Twice a day for 8 weeks · Dose 7.5 mg per kg (max 500 mg per dose)"
        selected={selected.clarithromycin}
        onToggle={() => setOral(BURULI_DRUGS.clarithromycin, !selected.clarithromycin)}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <DoseUnitSelect
            options={CLA_OPTIONS.map((t) => `${t} mg`)}
            value={`${clarithromycinTabletMg || 500} mg`}
            onChange={(v) => onChange({ clarithromycinTabletMg: Number(String(v).replace(/\D/g, "")) || 500 })}
            testid="buruli-clarithromycin-tablet"
          />
          <DosePhysicalBox
            testid="buruli-clarithromycin-dose"
            doseText={cla ? formatDosePhysical(cla.mg, cla.tabs) : ""}
            hint={cla ? `${weight} kg × 7.5 mg/kg${cla.capped ? " (capped at 500 mg/dose)" : ""} · ${cla.schedule}` : "Enter weight to calculate tablets."}
          />
        </div>
        {selected.clarithromycin && (
          <DrugVisitFields
            name={BURULI_DRUGS.clarithromycin}
            selected
            medCourses={medCourses}
            posology={posology}
            onChange={onChange}
            defaults={{
              dosage: cla ? `${formatDosePhysical(cla.mg, cla.tabs)} per dose` : "7.5 mg/kg",
              frequency: "Twice daily",
              duration: "8 weeks",
            }}
          />
        )}
      </DrugCard>
    </div>
  );
}

/** Build treatment summary string for encounter list / sidebar. */
export function buruliTreatmentSummary(d = {}) {
  const parts = [...(d.oral || [])];
  if (d.rifampicinTabletMg && parts.includes(BURULI_DRUGS.rifampicin)) {
    const i = parts.indexOf(BURULI_DRUGS.rifampicin);
    if (i >= 0) parts[i] = `${BURULI_DRUGS.rifampicin} · ${d.rifampicinTabletMg} mg tabs OD × 8w`;
  }
  if (d.clarithromycinTabletMg && parts.includes(BURULI_DRUGS.clarithromycin)) {
    const i = parts.indexOf(BURULI_DRUGS.clarithromycin);
    if (i >= 0) parts[i] = `${BURULI_DRUGS.clarithromycin} · ${d.clarithromycinTabletMg} mg tabs BID × 8w`;
  }
  return parts.join(" + ");
}
