import { useMemo } from "react";
import { Check } from "lucide-react";
import { AlertPanel, DrugCourseBlock, withDrugCourse } from "@/components/Fields";
import { ageInMonths } from "@/components/ScabiesMedications";
import { formatDosePhysical } from "@/lib/medications";

export const LEPROSY_DRUGS = {
  mdt: "Multi-Drug Therapy (MDT) Blister pack",
  prednisolone: "Tab Prednisolone 5mg",
};

const PREDNISOLONE_PHASES = [
  { label: "40 mg twice daily", mgPerDose: 40, dosesPerDay: 2, weeks: 2 },
  { label: "30 mg twice daily", mgPerDose: 30, dosesPerDay: 2, weeks: 2 },
  { label: "20 mg twice daily", mgPerDose: 20, dosesPerDay: 2, weeks: 2 },
  { label: "15 mg daily", mgPerDose: 15, dosesPerDay: 1, weeks: 2 },
  { label: "10 mg daily", mgPerDose: 10, dosesPerDay: 1, weeks: 2 },
  { label: "5 mg daily", mgPerDose: 5, dosesPerDay: 1, weeks: 2 },
];

const TAB_MG = 5;

export function prednisoloneSchedule() {
  const phases = PREDNISOLONE_PHASES.map((p) => {
    const days = p.weeks * 7;
    const tabsPerDose = p.mgPerDose / TAB_MG;
    const tabsPerDay = tabsPerDose * p.dosesPerDay;
    const tabs = tabsPerDay * days;
    return { ...p, days, tabsPerDose, tabsPerDay, tabs };
  });
  const totalTabs = phases.reduce((a, p) => a + p.tabs, 0);
  return { phases, totalTabs, tabletMg: TAB_MG };
}

/** Resolve WHO-style MDT blister band from age/weight. */
export function mdtBand({ years, weight }) {
  const w = Number(weight);
  const y = Number(years);
  const hasW = Number.isFinite(w) && w > 0;
  const hasY = Number.isFinite(y);

  if (hasW && w < 20) {
    return {
      id: "under20",
      title: "Children <20 kg",
      kind: "weight",
      note: "Please cut the tablets to equal to the dosage",
      items: [
        { drug: "Tab Dapsone", detail: "2 mg/kg Daily", mgPerKg: 2, frequency: "daily" },
        { drug: "Cap Rifampicin", detail: "10 mg/kg once a month", mgPerKg: 10, frequency: "monthly" },
        { drug: "Cap Clofazimine", detail: "6 mg/kg monthly and 1 mg/kg daily", monthlyMgPerKg: 6, dailyMgPerKg: 1 },
      ],
    };
  }

  if (hasY && y >= 15) {
    return {
      id: "adult",
      title: "Adults 15 and above",
      kind: "fixed",
      items: [
        { drug: "Tab Dapsone", detail: "100 mg Daily", mg: 100, frequency: "daily", tabletMg: 100, tabs: 1 },
        { drug: "Cap Rifampicin", detail: "600 mg once a month", mg: 600, frequency: "monthly", tabletMg: 300, tabs: 2 },
        { drug: "Cap Clofazimine", detail: "300 mg monthly and 50 mg daily", monthlyMg: 300, dailyMg: 50, monthlyTabs: 3, dailyTabs: 1, tabletMg: 100 },
      ],
    };
  }

  if (hasY && y >= 10 && y < 15) {
    return {
      id: "child10_14",
      title: "Children 10–14 years",
      kind: "fixed",
      items: [
        { drug: "Tab Dapsone", detail: "50 mg Daily", mg: 50, frequency: "daily", tabletMg: 50, tabs: 1 },
        { drug: "Cap Rifampicin", detail: "450 mg once a month", mg: 450, frequency: "monthly", tabletMg: 150, tabs: 3 },
        { drug: "Cap Clofazimine", detail: "150 mg monthly and 50 mg every other day", monthlyMg: 150, eodMg: 50, monthlyTabs: 1.5, eodTabs: 1, tabletMg: 100 },
      ],
    };
  }

  if ((hasY && y < 10) || (hasW && w >= 20 && w < 40)) {
    return {
      id: "child_small",
      title: "Children <10 years or 20–40 kg",
      kind: "fixed",
      note: "Please cut the tablets to equal to the dosage",
      items: [
        { drug: "Tab Dapsone", detail: "25 mg Daily", mg: 25, frequency: "daily", tabletMg: 50, tabs: 0.5 },
        { drug: "Cap Rifampicin", detail: "300 mg once a month", mg: 300, frequency: "monthly", tabletMg: 300, tabs: 1 },
        { drug: "Cap Clofazimine", detail: "150 mg monthly and 50 mg twice weekly", monthlyMg: 150, twiceWeeklyMg: 50, monthlyTabs: 1.5, twiceWeeklyTabs: 1, tabletMg: 100 },
      ],
    };
  }

  return null;
}

function formatWeightDose(weight, mgPerKg) {
  if (!weight || !mgPerKg) return null;
  const mg = weight * mgPerKg;
  return { mg, text: `${mg.toFixed(1)} mg` };
}

function DrugCard({ id, title, selected, onToggle, children, subtitle }) {
  return (
    <div
      className={`rounded-lg border p-4 ${selected ? "border-primary bg-secondary/40" : "border-border bg-white"}`}
      data-testid={`leprosy-drug-${id}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 text-left"
        data-testid={`leprosy-drug-toggle-${id}`}
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

function MdtTable({ band, weight }) {
  if (!band) {
    return <p className="text-sm text-muted-foreground">Enter age/DOB and weight to select the MDT blister band.</p>;
  }

  return (
    <div className="space-y-3" data-testid={`mdt-band-${band.id}`}>
      <p className="text-sm font-semibold" data-testid="mdt-band-title">
        Band: {band.title}
      </p>
      {band.note && (
        <AlertPanel level="info" title="Note" testid="mdt-cut-note">
          {band.note}
        </AlertPanel>
      )}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-semibold">Medication</th>
              <th className="px-3 py-2 font-semibold">Dose</th>
              <th className="px-3 py-2 font-semibold">Tablets / caps</th>
            </tr>
          </thead>
          <tbody>
            {band.items.map((item) => {
              let tabsLabel = "—";
              if (band.kind === "weight") {
                if (item.mgPerKg) {
                  const d = formatWeightDose(weight, item.mgPerKg);
                  tabsLabel = d
                    ? `${d.text} (${item.frequency}) — cut tablets to match`
                    : "Enter weight";
                } else if (item.monthlyMgPerKg != null) {
                  const m = formatWeightDose(weight, item.monthlyMgPerKg);
                  const day = formatWeightDose(weight, item.dailyMgPerKg);
                  tabsLabel = m && day
                    ? `Monthly ${m.text}; daily ${day.text} — cut to match`
                    : "Enter weight";
                }
              } else if (item.tabs != null) {
                tabsLabel = formatDosePhysical(item.mg, item.tabs);
              } else if (item.monthlyTabs != null && item.dailyTabs != null) {
                tabsLabel = `Monthly ${item.monthlyTabs} × ${item.tabletMg} mg; daily ${item.dailyTabs} × 50 mg`;
              } else if (item.monthlyTabs != null && item.eodTabs != null) {
                tabsLabel = `Monthly ${item.monthlyTabs} × ${item.tabletMg} mg; every other day ${item.eodTabs} × 50 mg`;
              } else if (item.monthlyTabs != null && item.twiceWeeklyTabs != null) {
                tabsLabel = `Monthly ${item.monthlyTabs} × ${item.tabletMg} mg; twice weekly ${item.twiceWeeklyTabs} × 50 mg`;
              }
              return (
                <tr key={item.drug} className="border-t border-border bg-white">
                  <td className="px-3 py-2 font-medium">{item.drug}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.detail}</td>
                  <td className="px-3 py-2 font-semibold">{tabsLabel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Leprosy section 6 — MDT blister pack by age/weight + prednisolone if reaction recorded.
 */
export default function LeprosyMedications({
  oral = [],
  onChange,
  patient = {},
  weight = 0,
  reactions = [],
  medCourses = {},
}) {
  const months = ageInMonths(patient);
  const years = months != null ? months / 12 : Number(patient.age);
  const yearsNum = Number.isFinite(years) ? years : null;
  const band = mdtBand({ years: yearsNum, weight });
  const hasReaction = Array.isArray(reactions) && reactions.length > 0;
  const pred = prednisoloneSchedule();

  const selected = useMemo(
    () => ({
      mdt: oral.includes(LEPROSY_DRUGS.mdt),
      prednisolone: oral.includes(LEPROSY_DRUGS.prednisolone),
    }),
    [oral],
  );

  const setOral = (name, on) => {
    const next = on ? [...new Set([...oral, name])] : oral.filter((x) => x !== name);
    onChange({
      oral: next,
      medCourses: withDrugCourse(medCourses, name, on),
      ...(on && name === LEPROSY_DRUGS.mdt && band ? { mdtBandId: band.id } : {}),
    });
  };

  return (
    <div className="space-y-5" data-testid="leprosy-medications">
      <p className="text-sm text-muted-foreground">
        Select MDT blister pack (auto band from age/weight). Prednisolone appears when a leprosy reaction assessment is recorded.
      </p>

      {/* A) MDT */}
      <div className="space-y-3">
        <p className="font-head text-base font-semibold tracking-tight">A) Multi-Drug Therapy (MDT) Blister pack</p>
        <DrugCard
          id="mdt"
          title={LEPROSY_DRUGS.mdt}
          subtitle={band ? band.title : "Age/weight band pending"}
          selected={selected.mdt}
          onToggle={() => setOral(LEPROSY_DRUGS.mdt, !selected.mdt)}
        >
          <div className="overflow-x-auto rounded-md border border-border mb-3">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Age / weight</th>
                  <th className="px-3 py-2 font-semibold">Medications</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                <tr className="border-t border-border">
                  <td className="px-3 py-2 align-top font-medium">Adults 15 and above</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    Tab Dapsone 100 mg Daily<br />
                    Cap Rifampicin 600 mg once a month<br />
                    Cap Clofazimine 300 mg monthly and 50 mg daily
                  </td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 align-top font-medium">Children 10–14 years</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    Tab Dapsone 50 mg Daily<br />
                    Cap Rifampicin 450 mg once a month<br />
                    Cap Clofazimine 150 mg monthly and 50 mg every other day
                  </td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 align-top font-medium">Children &lt;10 years or 20–40 kg</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    Tab Dapsone 25 mg Daily<br />
                    Cap Rifampicin 300 mg once a month<br />
                    Cap Clofazimine 150 mg monthly and 50 mg twice weekly
                    <span className="mt-1 block text-xs">Note: Please cut the tablets to equal to the dosage</span>
                  </td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 align-top font-medium">Children &lt;20 kg</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    Tab Dapsone 2 mg/kg Daily<br />
                    Cap Rifampicin 10 mg/kg once a month<br />
                    Cap Clofazimine 6 mg/kg monthly and 1 mg/kg daily
                    <span className="mt-1 block text-xs">Note: Please cut the tablets to equal to the dosage</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <MdtTable band={band} weight={weight} />
          {selected.mdt && (
            <DrugCourseBlock name={LEPROSY_DRUGS.mdt} medCourses={medCourses} onChange={onChange} />
          )}
        </DrugCard>
      </div>

      {/* B) Prednisolone if reaction filled */}
      {hasReaction ? (
        <div className="space-y-3" data-testid="leprosy-prednisolone-section">
          <p className="font-head text-base font-semibold tracking-tight">B) Reaction treatment</p>
          <DrugCard
            id="prednisolone"
            title={LEPROSY_DRUGS.prednisolone}
            subtitle="Taper schedule · tablet strength 5 mg"
            selected={selected.prednisolone}
            onToggle={() => setOral(LEPROSY_DRUGS.prednisolone, !selected.prednisolone)}
          >
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[420px] text-left text-sm" data-testid="prednisolone-table">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Dose</th>
                    <th className="px-3 py-2 font-semibold">Duration</th>
                    <th className="px-3 py-2 font-semibold">Tabs / day</th>
                    <th className="px-3 py-2 font-semibold">No. of 5 mg tablets</th>
                  </tr>
                </thead>
                <tbody>
                  {pred.phases.map((p) => (
                    <tr key={p.label} className="border-t border-border bg-white">
                      <td className="px-3 py-2 font-medium">{p.label}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.weeks} weeks ({p.days} days)</td>
                      <td className="px-3 py-2">{p.tabsPerDay}</td>
                      <td className="px-3 py-2 font-semibold">{p.tabs}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-border bg-secondary/40">
                    <td className="px-3 py-2 font-semibold" colSpan={3}>Total tablets (5 mg)</td>
                    <td className="px-3 py-2 font-bold" data-testid="prednisolone-total-tabs">{pred.totalTabs}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {selected.prednisolone && (
              <DrugCourseBlock name={LEPROSY_DRUGS.prednisolone} medCourses={medCourses} onChange={onChange} />
            )}
          </DrugCard>
        </div>
      ) : (
        <AlertPanel level="info" title="Reaction treatment" testid="leprosy-prednisolone-locked">
          Tab Prednisolone 5 mg taper appears here after a Leprosy reaction assessment is filled in.
        </AlertPanel>
      )}
    </div>
  );
}

export function leprosyTreatmentSummary(d = {}) {
  const parts = [...(d.oral || [])];
  if (d.mdtBandId && parts.includes(LEPROSY_DRUGS.mdt)) {
    const i = parts.indexOf(LEPROSY_DRUGS.mdt);
    if (i >= 0) parts[i] = `${LEPROSY_DRUGS.mdt} (${d.mdtBandId})`;
  }
  return parts.join(" + ");
}

/** PB vs MB schedule lengths for adherence. */
export function mdtAdherenceConfig(diagnosis = "") {
  const dx = String(diagnosis || "");
  if (/paucibacillary|\bPB\b/i.test(dx)) {
    return { regimen: "PB", courseMonths: 6, checkboxMonths: 9, restartMissed: 3 };
  }
  if (/multibacillary|\bMB\b/i.test(dx)) {
    return { regimen: "MB", courseMonths: 12, checkboxMonths: 18, restartMissed: 6 };
  }
  return { regimen: "", courseMonths: 12, checkboxMonths: 18, restartMissed: 6 };
}
