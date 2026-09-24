import { Check } from "lucide-react";
import { AlertPanel, withDrugCourse } from "@/components/Fields";
import { AddDrugSelect, DrugVisitFields } from "@/components/MedicationShared";
import { dropVisitPosology, setVisitPosology, slugDrug } from "@/lib/medications";
import { ANC_DRUGS, ANC_DRUG_META } from "@/mock/antenatal";

function AdviceList({ items = [] }) {
  if (!items.length) return null;
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
      data-testid={`anc-drug-${id}`}
    >
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 text-left" data-testid={`anc-drug-toggle-${id}`}>
        <span
          className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded border ${
            selected ? "border-primary bg-primary text-white" : "border-input bg-white"
          }`}
        >
          {selected && <Check className="h-4 w-4" />}
        </span>
        <p className="font-semibold">{title}</p>
      </button>
      {children ? <div className="mt-3 space-y-3 border-t border-border/60 pt-3">{children}</div> : null}
    </div>
  );
}

const metaFor = (name) => ANC_DRUG_META[name] || {};

/**
 * ANC drugs — select first; advice + visit posology only appear after selection.
 */
export default function AntenatalMedications({
  drugs = [],
  posology = {},
  medCourses = {},
  catalogue = [],
  onChange,
}) {
  const selected = new Set(drugs || []);
  const extras = (drugs || []).filter((n) => !ANC_DRUGS.includes(n));

  const toggle = (name, on) => {
    const next = on ? [...new Set([...(drugs || []), name])] : (drugs || []).filter((x) => x !== name);
    const meta = metaFor(name);
    let nextPosology = on ? posology : dropVisitPosology(posology, name);
    if (on && !posology?.[name] && (meta.dosage || meta.frequency || meta.duration)) {
      nextPosology = setVisitPosology(posology, name, {
        dosage: meta.dosage || "",
        frequency: meta.frequency || "",
        duration: meta.duration || "",
        advice: (meta.advice || []).join(" "),
      }, meta);
    }
    onChange({
      drugs: next,
      medCourses: withDrugCourse(medCourses, name, on),
      posology: nextPosology,
    });
  };

  const patchVisit = (patch) => onChange(patch);

  const renderCardBody = (name, on) => {
    const meta = metaFor(name);
    const hasAdvice = meta.advice?.length > 0;
    const hasNote = !!meta.note;
    if (!hasAdvice && !hasNote && !on) return null;
    return (
      <>
        {hasAdvice && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Advice</p>
            <AdviceList items={meta.advice} />
          </div>
        )}
        {hasNote && (
          <AlertPanel level="info" title="Note" testid={`anc-drug-note-${slugDrug(name)}`}>
            {meta.note}
          </AlertPanel>
        )}
        {on && (
          <DrugVisitFields
            name={name}
            selected
            medCourses={medCourses}
            posology={posology}
            onChange={patchVisit}
            catalogue={catalogue}
            defaults={{
              dosage: meta.dosage || "",
              frequency: meta.frequency || "",
              duration: meta.duration || "",
            }}
          />
        )}
      </>
    );
  };

  return (
    <div className="space-y-4" data-testid="anc-medications">
      <p className="text-sm text-muted-foreground">
        Select medications for this visit. Advice and notes follow each option; posology appears after you select a drug.
      </p>
      <AlertPanel level="info" title="Regimen by GA" testid="anc-drug-ga-note">
        GA-based regimen suggestions will be added later. Select standard drugs for now.
      </AlertPanel>

      {ANC_DRUGS.map((name) => {
        const on = selected.has(name);
        return (
          <DrugCard
            key={name}
            id={slugDrug(name)}
            title={name}
            selected={on}
            onToggle={() => toggle(name, !on)}
          >
            {renderCardBody(name, on)}
          </DrugCard>
        );
      })}

      {extras.map((name) => {
        const on = selected.has(name);
        return (
          <DrugCard
            key={name}
            id={slugDrug(name)}
            title={name}
            selected={on}
            onToggle={() => toggle(name, !on)}
          >
            {renderCardBody(name, on)}
          </DrugCard>
        );
      })}

      <AddDrugSelect
        catalogue={catalogue}
        diseaseId="antenatal"
        selected={drugs}
        testid="anc-drug-add"
        onAdd={(name) => toggle(name, true)}
      />
    </div>
  );
}

/** Build dashboard / print rows for an ANC visit's drugs. */
export function ancMedicationRows(visit) {
  const x = visit?.data || {};
  const names = x.drugs || [];
  const dateFallback = visit?.date || "";
  const rows = [];
  names.forEach((name) => {
    const meta = metaFor(name);
    const ov = (x.posology || {})[name] || {};
    const courses = Array.isArray(x.medCourses?.[name]) ? x.medCourses[name] : [];
    const stamps = courses.some((c) => c?.date)
      ? courses.map((c) => c.date)
      : [dateFallback];
    stamps.forEach((stamp, i) => {
      rows.push({
        name: stamps.length > 1 ? `${name} (${stamps.length - i})` : name,
        dosage: ov.dosage || meta.dosage || "—",
        frequency: ov.frequency || meta.frequency || "—",
        duration: ov.duration || meta.duration || "—",
        date: stamp || dateFallback || "—",
        advice: ov.advice || (meta.advice || []).join(" ") || "",
      });
    });
  });
  return rows;
}
