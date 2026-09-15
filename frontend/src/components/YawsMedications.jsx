import { useMemo } from "react";
import { Check } from "lucide-react";
import { AlertPanel, DrugCourseBlock, withDrugCourse } from "@/components/Fields";
import { ageInMonths } from "@/components/ScabiesMedications";
import { DosePhysicalBox, DoseUnitSelect } from "@/components/MedicationShared";
import { formatDosePhysical, physicalUnits } from "@/lib/medications";

export const YAWS_DRUGS = {
  azithromycin: "Tab Azithromycin 500mg (30mg per Kg)",
  benzathine: "Inj Benzathine penicillin",
};

const AZITH_TABLE = [
  { ageLabel: "<6y", weightLabel: "<20", mg: 500, tabs: 1 },
  { ageLabel: "6–9y", weightLabel: "20–35", mg: 1000, tabs: 2 },
  { ageLabel: "10–14y", weightLabel: "35–50", mg: 1500, tabs: 3 },
  { ageLabel: "15+", weightLabel: "≥50", mg: 2000, tabs: 4 },
];

const BENZATHINE_TABLE = [
  { weightLabel: "3–9", mls: 1 },
  { weightLabel: "10–19.9", mls: 2 },
  { weightLabel: "20–29.9", mls: 3 },
  { weightLabel: "30–39.9", mls: 4 },
  { weightLabel: "40–49.9", mls: 5 },
  { weightLabel: "Adult (≥50)", mls: 5 },
];

/** Azithromycin band from weight (preferred) or age in years. */
export function azithromycinDose({ weight, years }) {
  const w = Number(weight);
  if (Number.isFinite(w) && w > 0) {
    if (w < 20) return { mg: 500, tabs: 1, basis: "weight", band: "<20 kg" };
    if (w < 35) return { mg: 1000, tabs: 2, basis: "weight", band: "20–35 kg" };
    if (w < 50) return { mg: 1500, tabs: 3, basis: "weight", band: "35–50 kg" };
    return { mg: 2000, tabs: 4, basis: "weight", band: "≥50 kg" };
  }
  const y = Number(years);
  if (!Number.isFinite(y)) return null;
  if (y < 6) return { mg: 500, tabs: 1, basis: "age", band: "<6y" };
  if (y < 10) return { mg: 1000, tabs: 2, basis: "age", band: "6–9y" };
  if (y < 15) return { mg: 1500, tabs: 3, basis: "age", band: "10–14y" };
  return { mg: 2000, tabs: 4, basis: "age", band: "15+" };
}

/** Benzathine penicillin volume (mls IMI) from weight; adults (≥50 kg or ≥15y) get 5 mls. */
export function benzathineDose({ weight, years }) {
  const w = Number(weight);
  const y = Number(years);
  const adultByAge = Number.isFinite(y) && y >= 15;
  if (Number.isFinite(w) && w > 0) {
    if (w < 3) return { mls: null, band: "<3 kg", note: "Below protocol minimum weight (3 kg)." };
    if (w <= 9) return { mls: 1, band: "3–9 kg" };
    if (w < 20) return { mls: 2, band: "10–19.9 kg" };
    if (w < 30) return { mls: 3, band: "20–29.9 kg" };
    if (w < 40) return { mls: 4, band: "30–39.9 kg" };
    if (w < 50) return { mls: 5, band: "40–49.9 kg" };
    return { mls: 5, band: "Adult (≥50 kg)" };
  }
  if (adultByAge) return { mls: 5, band: "Adult (by age)" };
  return null;
}

function AdviceList({ items }) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

function DrugCard({ id, title, selected, onToggle, children }) {
  return (
    <div
      className={`rounded-lg border p-4 ${selected ? "border-primary bg-secondary/40" : "border-border bg-white"}`}
      data-testid={`yaws-drug-${id}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 text-left"
        data-testid={`yaws-drug-toggle-${id}`}
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
        </div>
      </button>
      {children && <div className="mt-3 space-y-3 border-t border-border/60 pt-3">{children}</div>}
    </div>
  );
}

function DoseTable({ columns, rows, testid, highlightRow }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border" data-testid={testid}>
      <table className="w-full min-w-[320px] text-left text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`border-t border-border ${highlightRow === i ? "bg-secondary/60 font-semibold" : "bg-white"}`}
            >
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Yaws section 6 — medications with age/weight azithromycin banding and benzathine volume calc.
 */
export default function YawsMedications({
  oral = [],
  onChange,
  patient = {},
  weight = 0,
  medCourses = {},
  azithromycinTabletMg = 500,
}) {
  const months = ageInMonths(patient);
  const years = months != null ? months / 12 : Number(patient.age);
  const yearsNum = Number.isFinite(years) ? years : null;

  const selected = useMemo(
    () => ({
      azithromycin: oral.includes(YAWS_DRUGS.azithromycin),
      benzathine: oral.includes(YAWS_DRUGS.benzathine),
    }),
    [oral],
  );

  const azith = azithromycinDose({ weight, years: yearsNum });
  const azithTablet = Number(azithromycinTabletMg) || 500;
  const azithTabs = azith ? physicalUnits(azith.mg, azithTablet) : null;
  const benz = benzathineDose({ weight, years: yearsNum });

  const azithHighlight = azith
    ? AZITH_TABLE.findIndex((r) => r.mg === azith.mg)
    : -1;
  const benzHighlight = benz?.mls != null
    ? BENZATHINE_TABLE.findIndex((r) => {
        if (benz.band?.startsWith("Adult")) return r.weightLabel.startsWith("Adult");
        return r.mls === benz.mls && !r.weightLabel.startsWith("Adult");
      })
    : -1;

  const setOral = (name, on) => {
    const next = on ? [...new Set([...oral, name])] : oral.filter((x) => x !== name);
    onChange({ oral: next, medCourses: withDrugCourse(medCourses, name, on) });
  };

  return (
    <div className="space-y-4" data-testid="yaws-medications">
      <p className="text-sm text-muted-foreground">
        Select medications for this visit. Azithromycin and benzathine doses auto-calculate from weight and age.
      </p>

      {/* i. Azithromycin */}
      <DrugCard
        id="azithromycin"
        title={YAWS_DRUGS.azithromycin}
        selected={selected.azithromycin}
        onToggle={() => setOral(YAWS_DRUGS.azithromycin, !selected.azithromycin)}
      >
        <AlertPanel level="info" title="Note" testid="azithromycin-note">
          The dose of Azithromycin is calculated according to weight and age.
        </AlertPanel>

        <div className="grid gap-3 sm:grid-cols-2">
          <DoseUnitSelect
            options={["250 mg", "500 mg"]}
            value={`${azithTablet} mg`}
            onChange={(v) => onChange({ azithromycinTabletMg: Number(String(v).replace(/\D/g, "")) || 500 })}
            testid="azithromycin-tablet"
          />
          <DosePhysicalBox
            testid="azithromycin-dose"
            doseText={azith ? formatDosePhysical(azith.mg, azithTabs) : ""}
            hint={azith ? `Band ${azith.band} (by ${azith.basis})${weight ? ` · ${weight} kg` : ""}` : "Enter weight or age to calculate dose."}
          />
        </div>

        <DoseTable
          testid="azithromycin-table"
          columns={["By age", "By weight (kg)", "Mg", "No. of 500mg tabs"]}
          highlightRow={azithHighlight}
          rows={AZITH_TABLE.map((r) => [r.ageLabel, r.weightLabel, String(r.mg), String(r.tabs)])}
        />
        {selected.azithromycin && (
          <DrugCourseBlock name={YAWS_DRUGS.azithromycin} medCourses={medCourses} onChange={onChange} />
        )}
      </DrugCard>

      {/* iii. Benzathine penicillin */}
      <DrugCard
        id="benzathine"
        title={YAWS_DRUGS.benzathine}
        selected={selected.benzathine}
        onToggle={() => setOral(YAWS_DRUGS.benzathine, !selected.benzathine)}
      >
        <AlertPanel level="info" title="Note" testid="benzathine-note">
          Use Benzathine Penicillin 2.4 million units diluted with 5mls sterile water.
        </AlertPanel>

          <DosePhysicalBox
            testid="benzathine-dose"
            doseText={benz?.mls != null ? `${benz.mls}ml IMI` : ""}
            hint={benz?.mls != null ? `Band ${benz.band}${weight ? ` · ${weight} kg` : ""}` : benz?.note || "Enter weight (or adult age) to calculate volume."}
          />

        <DoseTable
          testid="benzathine-table"
          columns={["Weight (kg)", "Dose (mls) IMI"]}
          highlightRow={benzHighlight}
          rows={BENZATHINE_TABLE.map((r) => [r.weightLabel, String(r.mls)])}
        />
        <AdviceList items={["Intramuscular injection (IMI) after reconstitution as above."]} />
        {selected.benzathine && (
          <DrugCourseBlock name={YAWS_DRUGS.benzathine} medCourses={medCourses} onChange={onChange} />
        )}
      </DrugCard>
    </div>
  );
}

/** Build treatment summary string for encounter list / sidebar. */
export function yawsTreatmentSummary(d = {}) {
  const parts = [...(d.oral || [])];
  (d.oralAntibiotics || []).forEach((x) => parts.push(`Other oral antibiotic: ${x}`));
  (d.topicalAntibiotics || []).forEach((x) => parts.push(`Other topical antibiotic: ${x}`));
  return parts.join(" + ");
}
