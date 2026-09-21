import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertPanel, withDrugCourse } from "@/components/Fields";
import { ageInMonths } from "@/components/ScabiesMedications";
import { DosePhysicalBox, DoseUnitSelect, DrugVisitFields } from "@/components/MedicationShared";
import { formatDosePhysical, dropVisitPosology } from "@/lib/medications";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const LF_DRUGS = {
  ivermectin: "Tab Ivermectin (0.2 mg/kg)",
  albendazole: "Tab Albendazole 200mg",
  dec: "Tab DEC 100mg (6 mg/kg)",
  doxycycline: "Doxycycline 100mg tablet",
  dressing: "Dressing Material (Compression Bandage / Wound Care)",
  selfCare: "Self care kit",
};

export const LF_RECS = {
  hydrocele: "Surgery for Hydrocele",
  restAcute: "Rest during Acute Attacks",
};

const TABLET_OPTIONS = ["3", "6", "12"];

function halfTabs(mg, tabletMg) {
  if (!mg || !tabletMg) return null;
  return Math.round((mg / tabletMg) * 2) / 2;
}

export function ivermectinDose(weight, tabletMg = 3) {
  if (!weight || !tabletMg) return null;
  const mg = weight * 0.2;
  return { mg, tabs: halfTabs(mg, tabletMg), tabletMg };
}

/** Albendazole 200mg tabs: 200mg (<10y) or 400mg (10+). */
export function albendazoleDose(years) {
  const y = Number(years);
  if (!Number.isFinite(y)) return null;
  if (y < 10) return { mg: 200, tabs: 1, band: "Child <10 years" };
  return { mg: 400, tabs: 2, band: "Adult 10+ years" };
}

export function decDose(weight, tabletMg = 100) {
  if (!weight || !tabletMg) return null;
  const mg = weight * 6;
  return { mg, tabs: halfTabs(mg, tabletMg), tabletMg };
}

function DrugCard({ id, title, selected, onToggle, children, disabled, disabledHint, subtitle }) {
  return (
    <div
      className={`rounded-lg border p-4 ${selected ? "border-primary bg-secondary/40" : "border-border bg-white"} ${disabled ? "opacity-70" : ""}`}
      data-testid={`lf-drug-${id}`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className="flex w-full items-start gap-3 text-left"
        data-testid={`lf-drug-toggle-${id}`}
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
          {disabled && disabledHint && <p className="mt-1 text-xs text-red-700">{disabledHint}</p>}
        </div>
      </button>
      {children && <div className="mt-3 space-y-3 border-t border-border/60 pt-3">{children}</div>}
    </div>
  );
}

export default function LfMedications({
  oral = [],
  topical = [],
  recommendations = [],
  ivermectinTabletMg = 3,
  onChange,
  patient = {},
  history = {},
  weight = 0,
  medCourses = {},
  posology = {},
  matchedRegimens = [],
  catalogue = [],
}) {
  const regimenVisit = { matchedRegimens, catalogue };
  const months = ageInMonths(patient);
  const years = months != null ? months / 12 : Number(patient.age);
  const yearsNum = Number.isFinite(years) ? years : null;
  const allergyYes = history.allergy === "Yes";
  const allergyDetail = String(history.allergyDetail || "").toLowerCase();
  const iverAllergy = allergyYes && allergyDetail.includes("ivermectin");

  const selected = useMemo(
    () => ({
      ivermectin: oral.includes(LF_DRUGS.ivermectin),
      albendazole: oral.includes(LF_DRUGS.albendazole),
      dec: oral.includes(LF_DRUGS.dec),
      doxycycline: oral.includes(LF_DRUGS.doxycycline),
      dressing: topical.includes(LF_DRUGS.dressing),
      selfCare: topical.includes(LF_DRUGS.selfCare),
      hydrocele: recommendations.includes(LF_RECS.hydrocele),
      restAcute: recommendations.includes(LF_RECS.restAcute),
    }),
    [oral, topical, recommendations],
  );

  const iverBlockedReasons = [];
  if (weight > 0 && weight < 15) iverBlockedReasons.push("Weight under 15 kg");
  if (iverAllergy) iverBlockedReasons.push("Known or possible allergy to Ivermectin");
  const iverContraindicated = iverBlockedReasons.length > 0;
  const doxyTooYoung = yearsNum != null && yearsNum < 8;

  const [iverDialog, setIverDialog] = useState(false);
  const [doxyDialog, setDoxyDialog] = useState(false);

  const iver = ivermectinDose(weight, Number(ivermectinTabletMg) || 3);
  const alb = albendazoleDose(yearsNum);
  const dec = decDose(weight, 100);

  const setOral = (name, on) => {
    const next = on ? [...new Set([...oral, name])] : oral.filter((x) => x !== name);
    onChange({
      oral: next,
      medCourses: withDrugCourse(medCourses, name, on),
      posology: on ? posology : dropVisitPosology(posology, name),
    });
  };
  const setTopical = (name, on) => {
    const next = on ? [...new Set([...topical, name])] : topical.filter((x) => x !== name);
    onChange({
      topical: next,
      medCourses: withDrugCourse(medCourses, name, on),
      posology: on ? posology : dropVisitPosology(posology, name),
    });
  };
  const setRec = (name, on) => {
    const next = on
      ? [...new Set([...recommendations, name])]
      : recommendations.filter((x) => x !== name);
    onChange({ recommendations: next });
  };

  const toggleIvermectin = () => {
    if (selected.ivermectin) {
      setOral(LF_DRUGS.ivermectin, false);
      return;
    }
    if (iverContraindicated) {
      setIverDialog(true);
      return;
    }
    setOral(LF_DRUGS.ivermectin, true);
  };

  const toggleDoxy = () => {
    if (selected.doxycycline) {
      setOral(LF_DRUGS.doxycycline, false);
      return;
    }
    if (doxyTooYoung) {
      setDoxyDialog(true);
      return;
    }
    setOral(LF_DRUGS.doxycycline, true);
  };

  return (
    <div className="space-y-5" data-testid="lf-medications">
      <p className="text-sm text-muted-foreground">
        Select drugs and supportive care for this visit. IDA doses auto-calculate from weight and age.
      </p>

      {/* a) Triple Drug Therapy — IDA */}
      <div className="space-y-3" data-testid="lf-ida-section">
        <div>
          <p className="font-head text-base font-semibold tracking-tight">
            Triple Drug Therapy — IDA
          </p>
          <p className="text-sm text-muted-foreground">
            Ivermectin + DEC + Albendazole (single dose)
          </p>
        </div>

        <DrugCard
          id="ivermectin"
          title={LF_DRUGS.ivermectin}
          subtitle="Tablets: 3 mg / 6 mg / 12 mg · Dose 0.2 mg per kg"
          selected={selected.ivermectin}
          onToggle={toggleIvermectin}
        >
          <AlertPanel level="info" title="Note" testid="lf-ivermectin-note">
            Should not be given to children less than 15 kg and those allergic to Ivermectin.
          </AlertPanel>
          <div className="grid gap-3 sm:grid-cols-2">
            <DoseUnitSelect
              options={TABLET_OPTIONS.map((t) => `${t} mg`)}
              value={`${ivermectinTabletMg || 3} mg`}
              onChange={(v) => onChange({ ivermectinTabletMg: Number(String(v).replace(/\D/g, "")) || 3 })}
              testid="lf-ivermectin-tablet"
            />
            <DosePhysicalBox
              testid="lf-ivermectin-dose"
              doseText={iver ? formatDosePhysical(iver.mg, iver.tabs) : ""}
              hint={iver && weight ? `${weight} kg × 0.2 mg/kg` : "Enter weight to calculate tablets."}
            />
          </div>
          {selected.ivermectin && (
            <DrugVisitFields
              name={LF_DRUGS.ivermectin}
              selected
              medCourses={medCourses}
              posology={posology}
              onChange={onChange}
              {...regimenVisit}
              defaults={{
                dosage: iver ? formatDosePhysical(iver.mg, iver.tabs) : "0.2 mg/kg",
                frequency: "Once",
                duration: "Single dose (IDA)",
              }}
            />
          )}
        </DrugCard>

        <DrugCard
          id="albendazole"
          title={LF_DRUGS.albendazole}
          selected={selected.albendazole}
          onToggle={() => setOral(LF_DRUGS.albendazole, !selected.albendazole)}
        >
          <AlertPanel level="info" title="Note" testid="lf-albendazole-note">
            200 mg for child less than 10 years; 400 mg for adult 10+ years.
          </AlertPanel>
          <DosePhysicalBox
            testid="lf-albendazole-dose"
            doseText={alb ? formatDosePhysical(alb.mg, alb.tabs) : ""}
            hint={alb ? alb.band : "Enter age/DOB to calculate tablets."}
          />
          {selected.albendazole && (
            <DrugVisitFields
              name={LF_DRUGS.albendazole}
              selected
              medCourses={medCourses}
              posology={posology}
              onChange={onChange}
              {...regimenVisit}
              defaults={{
                dosage: alb ? formatDosePhysical(alb.mg, alb.tabs) : "200 mg (<10y) / 400 mg (10y+)",
                frequency: "Once",
                duration: "Single dose (IDA)",
              }}
            />
          )}
        </DrugCard>

        <DrugCard
          id="dec"
          title={LF_DRUGS.dec}
          selected={selected.dec}
          onToggle={() => setOral(LF_DRUGS.dec, !selected.dec)}
        >
          <DosePhysicalBox
            testid="lf-dec-dose"
            doseText={dec ? formatDosePhysical(dec.mg, dec.tabs) : ""}
            hint={dec && weight ? `${weight} kg × 6 mg/kg` : "Enter weight to calculate tablets."}
          />
          {selected.dec && (
            <DrugVisitFields
              name={LF_DRUGS.dec}
              selected
              medCourses={medCourses}
              posology={posology}
              onChange={onChange}
              {...regimenVisit}
              defaults={{
                dosage: dec ? formatDosePhysical(dec.mg, dec.tabs) : "6 mg/kg",
                frequency: "Once",
                duration: "Single dose (IDA)",
              }}
            />
          )}
        </DrugCard>
      </div>

      {/* b) Doxycycline */}
      <DrugCard
        id="doxycycline"
        title={LF_DRUGS.doxycycline}
        selected={selected.doxycycline}
        onToggle={toggleDoxy}
      >
        <AlertPanel level={doxyTooYoung ? "review" : "info"} title="Note" testid="lf-doxycycline-note">
          Not recommended for children under 8 years old.
          {doxyTooYoung ? " This patient is under 8 years." : ""}
        </AlertPanel>
        {selected.doxycycline && (
          <DrugVisitFields
            name={LF_DRUGS.doxycycline}
            selected
            medCourses={medCourses}
            posology={posology}
            onChange={onChange}
            {...regimenVisit}
            defaults={{
              dosage: "100 mg",
              frequency: "As prescribed",
              duration: "—",
            }}
          />
        )}
      </DrugCard>

      {/* c–d) Supportive */}
      <DrugCard
        id="dressing"
        title={LF_DRUGS.dressing}
        selected={selected.dressing}
        onToggle={() => setTopical(LF_DRUGS.dressing, !selected.dressing)}
      >
        {selected.dressing && (
          <DrugVisitFields
            name={LF_DRUGS.dressing}
            selected
            medCourses={medCourses}
            posology={posology}
            onChange={onChange}
            {...regimenVisit}
            defaults={{ dosage: "Apply", frequency: "As needed", duration: "—" }}
          />
        )}
      </DrugCard>
      <DrugCard
        id="self-care"
        title={LF_DRUGS.selfCare}
        selected={selected.selfCare}
        onToggle={() => setTopical(LF_DRUGS.selfCare, !selected.selfCare)}
      >
        {selected.selfCare && (
          <DrugVisitFields
            name={LF_DRUGS.selfCare}
            selected
            medCourses={medCourses}
            posology={posology}
            onChange={onChange}
            {...regimenVisit}
            defaults={{ dosage: "—", frequency: "Daily self-care", duration: "—" }}
          />
        )}
      </DrugCard>

      {/* e) Recommendation */}
      <div className="space-y-3" data-testid="lf-recs-section">
        <p className="font-head text-base font-semibold tracking-tight">Recommendation</p>
        <DrugCard
          id="hydrocele"
          title={LF_RECS.hydrocele}
          selected={selected.hydrocele}
          onToggle={() => setRec(LF_RECS.hydrocele, !selected.hydrocele)}
        />
        <DrugCard
          id="rest-acute"
          title={LF_RECS.restAcute}
          selected={selected.restAcute}
          onToggle={() => setRec(LF_RECS.restAcute, !selected.restAcute)}
        />
      </div>

      <Dialog open={iverDialog} onOpenChange={setIverDialog}>
        <DialogContent className="sm:max-w-lg" data-testid="lf-ivermectin-warning-dialog">
          <DialogHeader>
            <DialogTitle>Ivermectin not recommended</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This patient meets one or more criteria where ivermectin should not be given:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {iverBlockedReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" data-testid="lf-ivermectin-cancel" onClick={() => setIverDialog(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              data-testid="lf-ivermectin-override"
              onClick={() => {
                setOral(LF_DRUGS.ivermectin, true);
                setIverDialog(false);
              }}
            >
              Prescribe anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={doxyDialog} onOpenChange={setDoxyDialog}>
        <DialogContent className="sm:max-w-lg" data-testid="lf-doxycycline-warning-dialog">
          <DialogHeader>
            <DialogTitle>Doxycycline not recommended</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Doxycycline is not recommended for children under 8 years old.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" data-testid="lf-doxycycline-cancel" onClick={() => setDoxyDialog(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              data-testid="lf-doxycycline-override"
              onClick={() => {
                setOral(LF_DRUGS.doxycycline, true);
                setDoxyDialog(false);
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
export function lfTreatmentSummary(d = {}) {
  const parts = [...(d.oral || []), ...(d.topical || [])];
  if (d.ivermectinTabletMg && (d.oral || []).includes(LF_DRUGS.ivermectin)) {
    const i = parts.indexOf(LF_DRUGS.ivermectin);
    if (i >= 0) parts[i] = `${LF_DRUGS.ivermectin} · ${d.ivermectinTabletMg} mg tabs`;
  }
  (d.recommendations || []).forEach((r) => {
    if (r === LF_RECS.hydrocele || r === LF_RECS.restAcute) parts.push(r);
  });
  return parts.join(" + ");
}
