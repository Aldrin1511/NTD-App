import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, SelectField, TextField, DrugCourseBlock, withDrugCourse } from "@/components/Fields";
import { DRUG_FREQUENCIES } from "@/mock/data";
import { searchDrugInventory } from "@/lib/hmisApi";
import {
  catalogueForDisease,
  extraDrugNames,
  isTopicalForm,
  hideVisitPosology,
  parseTabletOptions,
  dropVisitPosology,
  setVisitPosology,
  slugDrug,
  posologyDefaultsFromRegimens,
} from "@/lib/medications";

export function RegimenBanner({ names = [] }) {
  if (!names.length) return null;
  return (
    <div className="rounded-lg border border-primary/30 bg-secondary/50 px-4 py-3" data-testid="regimen-banner">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Regimen</p>
      <p className="mt-1 font-semibold" data-testid="regimen-name">{names.join(" · ")}</p>
      <p className="mt-1 text-xs text-muted-foreground">Matched from the regiment master by diagnosis, age and weight. Select extra drugs below if needed.</p>
    </div>
  );
}

export function DosePhysicalBox({ testid, doseText, hint }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3" data-testid={testid}>
      <p className="text-xs font-semibold text-muted-foreground">Dose / physical unit</p>
      {doseText ? (
        <p className="mt-1 text-sm font-semibold">
          {doseText}
          {hint ? <span className="mt-1 block text-xs font-normal text-muted-foreground">{hint}</span> : null}
        </p>
      ) : (
        <p className="mt-1 text-sm font-normal text-muted-foreground">{hint || "Enter age and weight to calculate."}</p>
      )}
    </div>
  );
}

export function DoseUnitSelect({ label = "Dose unit", options, value, onChange, testid }) {
  return (
    <SelectField
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      testid={testid}
    />
  );
}

/**
 * Angular-style drug autocomplete against Apex Drug inventory.
 * - Focus / empty input → no dropdown
 * - Typing a search key → inventory matches appear
 */
export function AddDrugSelect({
  catalogue = [],
  diseaseId,
  selected = [],
  onAdd,
  testid = "add-drug",
  online = true,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const wrapRef = useRef(null);
  const reqId = useRef(0);

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      setError("");
      return undefined;
    }
    if (!online) {
      // Offline: filter local protocol catalogue only
      const local = (catalogue.length ? catalogue : catalogueForDisease(catalogue, diseaseId))
        .map((d) => (typeof d === "string" ? { name: d } : d))
        .filter((d) => d?.name && !selected.includes(d.name))
        .filter((d) => String(d.name).toLowerCase().includes(q.toLowerCase()))
        .slice(0, 15);
      setResults(local);
      setOpen(true);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError("");
    const id = ++reqId.current;
    const t = setTimeout(() => {
      searchDrugInventory(q)
        .then((rows) => {
          if (id !== reqId.current) return;
          const opts = (rows || [])
            .filter((d) => d?.name && !selected.includes(d.name))
            .slice(0, 15);
          setResults(opts);
          setOpen(true);
        })
        .catch((err) => {
          if (id !== reqId.current) return;
          setResults([]);
          setError(err?.message || "Search failed");
          setOpen(true);
        })
        .finally(() => {
          if (id === reqId.current) setLoading(false);
        });
    }, 280);
    return () => clearTimeout(t);
  }, [query, online, catalogue, diseaseId, selected]);

  const pick = (drug) => {
    const name = typeof drug === "string" ? drug : drug?.name;
    if (!name) return;
    onAdd?.(name, typeof drug === "object" ? drug : undefined);
    setQuery("");
    setResults([]);
    setOpen(false);
    setError("");
  };

  return (
    <div className="rounded-lg border border-dashed border-border bg-white p-4" data-testid={`${testid}-wrap`} ref={wrapRef}>
      <Field label="Add drug">
        <div className="relative">
          <Input
            type="search"
            autoComplete="off"
            className="h-12 w-full bg-white text-base"
            placeholder="Type to search inventory…"
            value={query}
            data-testid={testid}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (query.trim() && results.length) setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                e.currentTarget.blur();
              }
              if (e.key === "Enter" && results[0]) {
                e.preventDefault();
                pick(results[0]);
              }
            }}
          />
          {open && query.trim() ? (
            <div
              className="absolute left-0 right-0 z-40 mt-1 max-h-60 overflow-auto rounded-md border border-border bg-white shadow-md"
              data-testid={`${testid}-menu`}
              role="listbox"
            >
              {loading ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Searching…</p>
              ) : error ? (
                <p className="px-3 py-2 text-sm text-destructive">{error}</p>
              ) : results.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">No stocked drugs match “{query.trim()}”.</p>
              ) : (
                results.map((d) => (
                  <button
                    key={d.tradeId || d.id || d.name}
                    type="button"
                    role="option"
                    className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/60"
                    data-testid={`${testid}-opt-${slugDrug(d.name)}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(d)}
                  >
                    <span className="min-w-0 flex-1 font-medium">{d.name}</span>
                    {d.stockLabel ? (
                      <span className="shrink-0 text-xs text-muted-foreground">Qty {d.stockLabel}</span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      </Field>
      <p className="mt-2 text-xs text-muted-foreground">
        Search Apex drug inventory (stocked items only). Type a name to see matches — the list stays empty until you search.
      </p>
    </div>
  );
}

export function VisitPosology({
  name,
  defaults = {},
  posology = {},
  onChange,
}) {
  const override = posology?.[name] || {};
  const dosage = override.dosage ?? defaults.dosage ?? "";
  const frequency = override.frequency ?? defaults.frequency ?? "";
  const duration = override.duration ?? defaults.duration ?? "";
  const freqOptions = [...new Set([frequency, defaults.frequency, ...DRUG_FREQUENCIES].filter(Boolean))];
  const slug = slugDrug(name);
  const patch = (next) => {
    onChange({ posology: setVisitPosology(posology, name, next, defaults) });
  };
  const reset = () => {
    onChange({ posology: dropVisitPosology(posology, name) });
  };
  const hasOverride = Boolean(posology?.[name]);

  return (
    <div className="space-y-3 rounded-md border border-dashed border-border bg-white p-3" data-testid={`visit-posology-${slug}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Posology for this visit</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Edits apply only to this encounter. The drug and regimen masters are not changed.
          </p>
        </div>
        {hasOverride && (
          <Button type="button" variant="ghost" className="h-8 shrink-0 px-2 text-xs" data-testid={`visit-posology-reset-${slug}`} onClick={reset}>
            Reset
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField
          label="Dosage"
          testid={`visit-posology-dosage-${slug}`}
          value={dosage}
          placeholder={defaults.dosage || "Dosage"}
          onChange={(e) => patch({ dosage: e.target.value })}
        />
        <SelectField
          label="Frequency"
          options={freqOptions}
          value={frequency}
          onChange={(v) => patch({ frequency: v })}
          testid={`visit-posology-frequency-${slug}`}
        />
        <TextField
          label="Duration"
          testid={`visit-posology-duration-${slug}`}
          value={duration}
          placeholder={defaults.duration || "Duration"}
          onChange={(e) => patch({ duration: e.target.value })}
        />
      </div>
    </div>
  );
}

export function DrugVisitFields({
  name,
  selected,
  medCourses,
  posology = {},
  defaults = {},
  matchedRegimens = [],
  allRegimens = [],
  catalogue = [],
  onChange,
}) {
  if (!selected) return null;
  const merged = posologyDefaultsFromRegimens(name, matchedRegimens, catalogue, defaults, allRegimens);
  return (
    <>
      {!hideVisitPosology(name) && (
        <VisitPosology name={name} defaults={merged} posology={posology} onChange={onChange} />
      )}
      <DrugCourseBlock name={name} medCourses={medCourses} onChange={onChange} />
    </>
  );
}

export function ExtraSelectedDrugs({
  diseaseId,
  topical = [],
  oral = [],
  catalogue = [],
  medCourses = {},
  posology = {},
  defaults = {},
  matchedRegimens = [],
  allRegimens = [],
  onChange,
}) {
  const extras = extraDrugNames(diseaseId, topical, oral);
  if (!extras.length) return null;
  const remove = (name) => {
    const drug = catalogue.find((d) => d.name === name);
    const topicalNext = topical.filter((x) => x !== name);
    const oralNext = oral.filter((x) => x !== name);
    onChange({
      topical: isTopicalForm(drug?.form) ? topicalNext : topical.filter((x) => x !== name),
      oral: isTopicalForm(drug?.form) ? oral.filter((x) => x !== name) : oralNext,
      medCourses: withDrugCourse(medCourses, name, false),
      posology: dropVisitPosology(posology, name),
    });
  };
  return (
    <div className="space-y-3" data-testid="extra-drugs">
      {extras.map((name) => {
        const drug = catalogue.find((d) => d.name === name);
        const tabs = parseTabletOptions(drug?.strength);
        const masterDefaults = posologyDefaultsFromRegimens(name, matchedRegimens, catalogue, defaults, allRegimens);
        return (
          <div key={name} className="rounded-lg border border-border bg-white p-4" data-testid={`extra-drug-${name}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{name}</p>
                <p className="text-xs text-muted-foreground">{[drug?.form, drug?.strength].filter(Boolean).join(" · ")}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-600" onClick={() => remove(name)} data-testid={`extra-drug-remove-${name}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {tabs.length > 1 && (
              <p className="mt-2 text-xs text-muted-foreground">Available strengths: {tabs.map((t) => `${t} mg`).join(", ")}</p>
            )}
            <div className="mt-3 space-y-3">
              {!hideVisitPosology(name) && (
                <VisitPosology
                  name={name}
                  defaults={masterDefaults}
                  posology={posology}
                  onChange={onChange}
                />
              )}
              <DrugCourseBlock name={name} medCourses={medCourses} onChange={onChange} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function addCatalogueDrug({ name, catalogue = [], topical = [], oral = [], medCourses = {}, posology = {}, matchedRegimens = [], allRegimens = [] }) {
  const drug = catalogue.find((d) => d.name === name);
  const next = isTopicalForm(drug?.form)
    ? { topical: [...new Set([...topical, name])], oral }
    : { topical, oral: [...new Set([...oral, name])] };
  const defaults = posologyDefaultsFromRegimens(name, matchedRegimens, catalogue, {}, allRegimens);
  const hasMaster = Boolean(defaults.dosage || defaults.frequency || defaults.duration);
  return {
    ...next,
    medCourses: withDrugCourse(medCourses, name, true),
    ...(hasMaster
      ? { posology: setVisitPosology(posology, name, {
          dosage: defaults.dosage,
          frequency: defaults.frequency,
          duration: defaults.duration,
        }, defaults) }
      : {}),
  };
}

export function PlusDrugHint() {
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <Plus className="h-3.5 w-3.5" /> Use Add drug to prescribe from the catalogue.
    </p>
  );
}
