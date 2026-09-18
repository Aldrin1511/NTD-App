import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertPanel, withDrugCourse } from "@/components/Fields";
import { DosePhysicalBox, DoseUnitSelect, DrugVisitFields } from "@/components/MedicationShared";
import { formatDosePhysical, dropVisitPosology } from "@/lib/medications";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const SCABIES_DRUGS = {
  permethrin: "Permethrin 5% Cream/Lotion",
  benzyl: "Benzyl Benzoate 25%",
  sulphur: "Sulphur 5% / 10% Ointment or Lotion",
  ivermectin: "Tab Ivermectin (0.2 mg/kg)",
};

const TABLET_OPTIONS = ["3", "6", "12"];

/** Age in whole months from DOB when available, else years × 12. */
export function ageInMonths(patient = {}) {
  if (patient.dob) {
    const dob = new Date(patient.dob);
    if (!Number.isNaN(dob.getTime())) {
      const now = new Date();
      let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
      if (now.getDate() < dob.getDate()) months -= 1;
      return Math.max(0, months);
    }
  }
  const years = Number(patient.age);
  if (!Number.isFinite(years)) return null;
  return Math.round(years * 12);
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

function DrugCard({ id, title, selected, onToggle, children, disabled, disabledHint }) {
  return (
    <div
      className={`rounded-lg border p-4 ${selected ? "border-primary bg-secondary/40" : "border-border bg-white"} ${disabled ? "opacity-70" : ""}`}
      data-testid={`scabies-drug-${id}`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className="flex w-full items-start gap-3 text-left"
        data-testid={`scabies-drug-toggle-${id}`}
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
          {disabled && disabledHint && <p className="mt-1 text-xs text-red-700">{disabledHint}</p>}
        </div>
      </button>
      {children && <div className="mt-3 space-y-3 border-t border-border/60 pt-3">{children}</div>}
    </div>
  );
}

function benzylGuidance(months) {
  if (months == null) return { ban: false, text: "Enter patient age/DOB to calculate dilution and contact time." };
  if (months < 6) {
    return { ban: true, text: "Infants under 6 months — do not prescribe Benzyl Benzoate." };
  }
  if (months < 24) {
    return {
      ban: false,
      text: "6 months to 2 years: Apply once using diluted ratio 1:3 (10 ml medicine + 30 ml water). Contact time 12 hours.",
    };
  }
  if (months < 12 * 12) {
    return {
      ban: false,
      text: "2–12 years: Apply twice using diluted ratio 1:1 (25 ml medicine + 25 ml water). Contact time 24 hours apart with one rinse between applications, or 2 successive applications 10 min apart when dry, then rinse after 24 hours.",
    };
  }
  return {
    ban: false,
    text: ">12 years: Apply once undiluted. Contact time 12 hours.",
  };
}

function ivermectinDose(weight, tabletMg) {
  if (!weight || !tabletMg) return null;
  const mg = weight * 0.2;
  const tabs = Math.round((mg / tabletMg) * 2) / 2;
  return { mg, tabs, tabletMg };
}

/**
 * Scabies section 6 — medications with protocol advice, age dosing, and ivermectin guardrails.
 */
export default function ScabiesMedications({
  topical = [],
  oral = [],
  topicalAntibiotics = [],
  oralAntibiotics = [],
  ivermectinTabletMg = 3,
  sulphurStrength = "5%",
  onChange,
  patient = {},
  caseDetails = {},
  history = {},
  weight = 0,
  medCourses = {},
  posology = {},
}) {
  const months = ageInMonths(patient);
  const years = months != null ? months / 12 : Number(patient.age) || null;
  const pregnant = caseDetails.pregnant === "Yes" || patient.pregnancy === "Yes";
  const breastfeeding = caseDetails.breastfeeding === "Yes" || patient.lactating === "Yes";
  const allergyYes = history.allergy === "Yes";
  const conditions = history.conditions || [];
  const liverKidney = conditions.includes("Liver Disease") || conditions.includes("Kidney Disease");

  const selected = useMemo(
    () => ({
      permethrin: topical.includes(SCABIES_DRUGS.permethrin),
      benzyl: topical.includes(SCABIES_DRUGS.benzyl),
      sulphur: topical.includes(SCABIES_DRUGS.sulphur),
      ivermectin: oral.includes(SCABIES_DRUGS.ivermectin),
    }),
    [topical, oral],
  );

  const benzyl = benzylGuidance(months);
  const permethrinTooYoung = months != null && months < 2;
  const sulphurPreferred = months != null && months < 2;

  const iverBlockedReasons = [];
  if (years != null && years < 5) iverBlockedReasons.push("Under 5 years of age");
  if (weight > 0 && weight < 15) iverBlockedReasons.push("Weight under 15 kg");
  if (pregnant) iverBlockedReasons.push("Pregnant");
  if (breastfeeding) iverBlockedReasons.push("Breastfeeding");
  if (allergyYes) iverBlockedReasons.push("Known drug allergy recorded");
  if (liverKidney) iverBlockedReasons.push("Severe liver or kidney disease recorded");
  const iverContraindicated = iverBlockedReasons.length > 0;

  const [iverDialog, setIverDialog] = useState(false);
  const dose = ivermectinDose(weight, Number(ivermectinTabletMg) || 3);

  const setTopical = (name, on) => {
    const next = on ? [...new Set([...topical, name])] : topical.filter((x) => x !== name);
    onChange({
      topical: next,
      medCourses: withDrugCourse(medCourses, name, on),
      posology: on ? posology : dropVisitPosology(posology, name),
    });
  };
  const setOral = (name, on) => {
    const next = on ? [...new Set([...oral, name])] : oral.filter((x) => x !== name);
    onChange({
      oral: next,
      medCourses: withDrugCourse(medCourses, name, on),
      posology: on ? posology : dropVisitPosology(posology, name),
    });
  };

  const toggleIvermectin = () => {
    if (selected.ivermectin) {
      setOral(SCABIES_DRUGS.ivermectin, false);
      return;
    }
    if (iverContraindicated) {
      setIverDialog(true);
      return;
    }
    setOral(SCABIES_DRUGS.ivermectin, true);
  };

  return (
    <div className="space-y-4" data-testid="scabies-medications">
      <p className="text-sm text-muted-foreground">
        Select medications for this visit. Advice and notes follow each option based on age, weight, and pregnancy status.
      </p>

      {/* i. Permethrin */}
      <DrugCard
        id="permethrin"
        title={SCABIES_DRUGS.permethrin}
        selected={selected.permethrin}
        disabled={permethrinTooYoung}
        disabledHint="Use ONLY in babies 2 months of age and older."
        onToggle={() => {
          if (permethrinTooYoung) return;
          setTopical(SCABIES_DRUGS.permethrin, !selected.permethrin);
        }}
      >
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Advice</p>
          <AdviceList
            items={[
              "Apply at night all over the body below the neck and leave it on all night and wash off in the morning.",
              "Repeat application 7 days later if still has symptoms.",
              "Wash bedding and dry in the sunlight.",
            ]}
          />
        </div>
        <AlertPanel level="info" title="Note" testid="permethrin-age-note">
          Use ONLY in babies 2 months of age and older.
        </AlertPanel>
        {(pregnant || breastfeeding) && (
          <AlertPanel level="routine" title="Pregnancy / lactation" testid="permethrin-preg-note">
            5% permethrin cream or lotion is considered safe in pregnancy and while lactating.
          </AlertPanel>
        )}
        {selected.permethrin && (
          <DrugVisitFields
            name={SCABIES_DRUGS.permethrin}
            selected
            medCourses={medCourses}
            posology={posology}
            onChange={onChange}
            defaults={{
              dosage: "Apply to body below the neck",
              frequency: "Once at night",
              duration: "Overnight; repeat in 7 days if needed",
            }}
          />
        )}
      </DrugCard>

      {/* ii. Benzyl Benzoate */}
      <DrugCard
        id="benzyl"
        title={SCABIES_DRUGS.benzyl}
        selected={selected.benzyl}
        disabled={benzyl.ban}
        disabledHint={benzyl.ban ? benzyl.text : undefined}
        onToggle={() => {
          if (benzyl.ban) return;
          setTopical(SCABIES_DRUGS.benzyl, !selected.benzyl);
        }}
      >
        <AlertPanel level="info" title="Note" testid="benzyl-note">
          Considered safe to use only in children older than 2 years if Permethrin 5% is unavailable.
        </AlertPanel>
        <AlertPanel level={benzyl.ban ? "urgent" : "review"} title="Age-based dosing" testid="benzyl-dosing">
          {benzyl.text}
        </AlertPanel>
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Advice</p>
          <AdviceList
            items={[
              "Do not apply to broken skin, the face or mucous membranes.",
              "May cause: burning sensation; contact dermatitis with repeated application; seizures if marked transcutaneous absorption; rarely hypersensitivity reactions.",
              "Avoid contact with eyes. If accidental contact, flush immediately with plenty of water.",
            ]}
          />
        </div>
        {selected.benzyl && (
          <DrugVisitFields
            name={SCABIES_DRUGS.benzyl}
            selected
            medCourses={medCourses}
            posology={posology}
            onChange={onChange}
            defaults={{
              dosage: months != null && months < 24
                ? "Dilute 1:3 (10 ml + 30 ml water)"
                : months != null && months < 144
                  ? "Dilute 1:1 (25 ml + 25 ml water)"
                  : "Undiluted",
              frequency: months != null && months >= 24 && months < 144 ? "Twice" : "Once",
              duration: months != null && months >= 24 && months < 144 ? "24 hours apart" : "12 hours contact",
            }}
          />
        )}
      </DrugCard>

      {/* iii. Sulphur */}
      <DrugCard
        id="sulphur"
        title={SCABIES_DRUGS.sulphur}
        selected={selected.sulphur}
        onToggle={() => setTopical(SCABIES_DRUGS.sulphur, !selected.sulphur)}
      >
        <AlertPanel level="info" title="Note" testid="sulphur-note">
          Preferred traditional treatment for infants under 2 months.
          {sulphurPreferred ? " This patient is under 2 months — sulphur is preferred." : ""}
        </AlertPanel>
        {selected.sulphur && (
          <DoseUnitSelect
            label="Dose unit"
            options={["5%", "10%"]}
            value={sulphurStrength || "5%"}
            onChange={(v) => onChange({ sulphurStrength: v })}
            testid="sulphur-strength"
          />
        )}
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Advice</p>
          <AdviceList
            items={[
              "Apply to the child’s entire body every night for 3 to 5 consecutive nights. Leave on for 24 hours before a brief wash and reapplication, or wash off in the morning depending on the protocol prescribed.",
            ]}
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Drawbacks</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Malodorous (rotten eggs), greasy, can stain clothing or bed sheets. May cause mild skin dryness or localized irritation (sulfur dermatitis).
          </p>
        </div>
        {selected.sulphur && (
          <DrugVisitFields
            name={SCABIES_DRUGS.sulphur}
            selected
            medCourses={medCourses}
            posology={posology}
            onChange={onChange}
            defaults={{
              dosage: sulphurStrength || "5%",
              frequency: "Every night",
              duration: "3–5 consecutive nights",
            }}
          />
        )}
      </DrugCard>

      {/* iv. Ivermectin */}
      <DrugCard
        id="ivermectin"
        title={SCABIES_DRUGS.ivermectin}
        selected={selected.ivermectin}
        onToggle={toggleIvermectin}
      >
        <p className="text-sm text-muted-foreground">Once today and once after 2 weeks. Dose 0.2 mg/kg by weight.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <DoseUnitSelect
            options={TABLET_OPTIONS.map((t) => `${t} mg`)}
            value={`${ivermectinTabletMg || 3} mg`}
            onChange={(v) => onChange({ ivermectinTabletMg: Number(String(v).replace(/\D/g, "")) || 3 })}
            testid="ivermectin-tablet"
          />
          <DosePhysicalBox
            testid="ivermectin-dose"
            doseText={dose ? formatDosePhysical(dose.mg, dose.tabs) : ""}
            hint={dose ? `× 2 doses (today + after 2 weeks) · ${dose.tabletMg} mg tablets` : "Enter weight in case details to calculate tablets."}
          />
        </div>
        <AlertPanel level="info" title="Note" testid="ivermectin-note">
          Not recommended for children under 5 years or weighing less than 15 kg, pregnant or breastfeeding women, and individuals with known hypersensitivity or severe liver and kidney disease.
        </AlertPanel>
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Advice</p>
          <AdviceList
            items={[
              "Oral ivermectin is indicated in topical failure, inability to comply with topical therapy, non-adherence, institutional outbreaks, mass treatment, and crusted scabies.",
              "Personal hygiene and washing linens.",
              "Itching can continue for 2 to 4 weeks after mites are dead (allergic reaction to mite remnants).",
            ]}
          />
        </div>
        {selected.ivermectin && (
          <DrugVisitFields
            name={SCABIES_DRUGS.ivermectin}
            selected
            medCourses={medCourses}
            posology={posology}
            onChange={onChange}
            defaults={{
              dosage: dose ? formatDosePhysical(dose.mg, dose.tabs) : "0.2 mg/kg",
              frequency: "Once",
              duration: "2 doses (today + after 2 weeks)",
            }}
          />
        )}
      </DrugCard>

      <Dialog open={iverDialog} onOpenChange={setIverDialog}>
        <DialogContent className="sm:max-w-lg" data-testid="ivermectin-warning-dialog">
          <DialogHeader>
            <DialogTitle>Ivermectin not recommended</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This patient meets one or more criteria where oral ivermectin is not recommended:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {iverBlockedReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" data-testid="ivermectin-cancel" onClick={() => setIverDialog(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              data-testid="ivermectin-override"
              onClick={() => {
                setOral(SCABIES_DRUGS.ivermectin, true);
                setIverDialog(false);
              }}
            >
              Prescribe anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Build treatment summary string for encounter list / sidebar. */
export function scabiesTreatmentSummary(d = {}) {
  const parts = [...(d.topical || []), ...(d.oral || [])];
  if (d.sulphurStrength && (d.topical || []).includes(SCABIES_DRUGS.sulphur)) {
    const i = parts.indexOf(SCABIES_DRUGS.sulphur);
    if (i >= 0) parts[i] = `${SCABIES_DRUGS.sulphur} (${d.sulphurStrength})`;
  }
  if (d.ivermectinTabletMg && (d.oral || []).includes(SCABIES_DRUGS.ivermectin)) {
    const i = parts.indexOf(SCABIES_DRUGS.ivermectin);
    if (i >= 0) parts[i] = `${SCABIES_DRUGS.ivermectin} · ${d.ivermectinTabletMg} mg tabs`;
  }
  (d.topicalAntibiotics || []).forEach((x) => parts.push(`Topical antibiotic: ${x}`));
  (d.oralAntibiotics || []).forEach((x) => parts.push(`Oral antibiotic: ${x}`));
  return parts.join(" + ");
}
