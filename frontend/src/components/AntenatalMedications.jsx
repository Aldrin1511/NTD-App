import { useState } from "react";
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

function DrugCard({ id, title, selected, onToggle, onActivate, testidPrefix, children }) {
  return (
    <div
      className={`rounded-lg border p-4 ${selected ? "border-primary bg-secondary/40" : "border-border bg-white"}`}
      data-testid={`${testidPrefix}-drug-${id}`}
      onFocusCapture={selected ? onActivate : undefined}
    >
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 text-left" data-testid={`${testidPrefix}-drug-toggle-${id}`}>
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

function CompactPosology({ name, meta, posology, onExpand, testidPrefix }) {
  const ov = posology?.[name] || {};
  const dosage = ov.dosage || meta.dosage || "—";
  const frequency = ov.frequency || meta.frequency || "—";
  const duration = ov.duration || meta.duration || "—";
  return (
    <button
      type="button"
      onClick={onExpand}
      className="w-full rounded-md border border-border/60 bg-white px-3 py-2 text-left text-sm hover:border-primary/40"
      data-testid={`${testidPrefix}-drug-compact-${slugDrug(name)}`}
    >
      <p className="font-medium text-foreground">{dosage}</p>
      <p className="text-muted-foreground">
        {frequency}
        {duration && duration !== "—" ? ` · ${duration}` : ""}
      </p>
    </button>
  );
}

/**
 * Condition drug cards — same UX as ANC: advice when unselected,
 * full posology when active, compact summary when selected earlier.
 */
export default function AntenatalMedications({
  drugs = [],
  posology = {},
  medCourses = {},
  catalogue = [],
  onChange,
  presetDrugs = ANC_DRUGS,
  drugMeta = ANC_DRUG_META,
  diseaseId = "antenatal",
  testid = "anc-medications",
  banner,
}) {
  const [activeDrug, setActiveDrug] = useState(null);
  const selected = new Set(drugs || []);
  const extras = (drugs || []).filter((n) => !presetDrugs.includes(n));
  const metaFor = (name) => drugMeta[name] || {};
  const prefix = testid.replace(/-medications$/, "") || "anc";

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
    setActiveDrug(on ? name : activeDrug === name ? null : activeDrug);
    onChange({
      drugs: next,
      medCourses: withDrugCourse(medCourses, name, on),
      posology: nextPosology,
    });
  };

  const patchVisit = (patch) => onChange(patch);

  const renderCardBody = (name, on) => {
    const meta = metaFor(name);
    if (on) {
      if (activeDrug === name) {
        return (
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
        );
      }
      return (
        <CompactPosology
          name={name}
          meta={meta}
          posology={posology}
          onExpand={() => setActiveDrug(name)}
          testidPrefix={prefix}
        />
      );
    }
    const hasAdvice = meta.advice?.length > 0;
    const hasNote = !!meta.note;
    if (!hasAdvice && !hasNote) return null;
    return (
      <>
        {hasAdvice && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Advice</p>
            <AdviceList items={meta.advice} />
          </div>
        )}
        {hasNote && (
          <AlertPanel level="info" title="Note" testid={`${prefix}-drug-note-${slugDrug(name)}`}>
            {meta.note}
          </AlertPanel>
        )}
      </>
    );
  };

  return (
    <div className="space-y-4" data-testid={testid}>
      <p className="text-sm text-muted-foreground">
        Review advice before selecting. After you move to another drug, earlier selections show only the name and posology.
      </p>
      {banner}

      {presetDrugs.map((name) => {
        const on = selected.has(name);
        return (
          <DrugCard
            key={name}
            id={slugDrug(name)}
            title={name}
            selected={on}
            onToggle={() => toggle(name, !on)}
            onActivate={() => setActiveDrug(name)}
            testidPrefix={prefix}
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
            onActivate={() => setActiveDrug(name)}
            testidPrefix={prefix}
          >
            {renderCardBody(name, on)}
          </DrugCard>
        );
      })}

      <AddDrugSelect
        catalogue={catalogue}
        diseaseId={diseaseId}
        selected={drugs}
        testid={`${prefix}-drug-add`}
        onAdd={(name) => toggle(name, true)}
      />
    </div>
  );
}

/** Build dashboard / print rows for a visit's drugs. */
export function medicationRows(visit, drugMeta = {}) {
  const x = visit?.data || {};
  const names = x.drugs || [];
  const dateFallback = visit?.date || "";
  const rows = [];
  names.forEach((name) => {
    const meta = drugMeta[name] || {};
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

export function ancMedicationRows(visit) {
  return medicationRows(visit, ANC_DRUG_META);
}
