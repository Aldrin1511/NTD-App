import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import PatientSidebar from "@/components/PatientSidebar";
import { Field, TextField, AreaField, SelectField } from "@/components/Fields";
import { ArrowLeft, Check, Save, ChevronDown, CircleCheck } from "lucide-react";

const ring = { green: "border-green-500", amber: "border-amber-500", red: "border-red-500", "": "border-border" };
const txt = { green: "text-green-700", amber: "text-amber-700", red: "text-red-700", "": "text-foreground" };

export const statusClasses = { ring, txt };

const roundStep = (v, step) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  if (step < 1) {
    const p = Math.round(1 / step);
    return Math.round(n * p) / p;
  }
  return Math.round(n);
};

/** Slider + typed number input. */
export const SliderStat = ({ field, value, onChange, status = "", testid }) => {
  const has = value !== undefined && value !== "" && value !== null;
  const mid = field.normal
    ? (field.normal[0] + field.normal[1]) / 2
    : (field.min + field.max) / 2;
  const cur = has ? Number(value) : mid;
  const [draft, setDraft] = useState(has ? String(value) : "");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(has ? String(value) : "");
  }, [value, has, editing]);

  const commit = (raw) => {
    setEditing(false);
    if (raw === "" || raw === "-" || raw === ".") {
      onChange("");
      setDraft("");
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      setDraft(has ? String(value) : "");
      return;
    }
    const next = roundStep(Math.min(field.max, Math.max(field.min, n)), field.step);
    onChange(next);
    setDraft(String(next));
  };

  return (
    <div className={`rounded-md border ${ring[status]} bg-white p-3`} data-testid={testid}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{field.label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            step={field.step}
            min={field.min}
            max={field.max}
            className={`h-8 w-20 rounded border border-input bg-white px-2 text-right text-sm font-bold tabular-nums ${txt[status]}`}
            value={editing ? draft : (has ? value : "")}
            placeholder="—"
            onFocus={() => { setEditing(true); setDraft(has ? String(value) : ""); }}
            onChange={(e) => { setEditing(true); setDraft(e.target.value); }}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            data-testid={`${testid}-input`}
          />
          <span className="text-xs font-medium text-muted-foreground">{field.unit}</span>
        </div>
      </div>
      <Slider
        className="mt-3"
        min={field.min}
        max={field.max}
        step={field.step}
        value={[has ? Number(value) : roundStep(cur, field.step)]}
        onValueChange={([v]) => {
          const next = roundStep(v, field.step);
          onChange(next);
          setDraft(String(next));
          setEditing(false);
        }}
        data-testid={`${testid}-slider`}
      />
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{field.min}</span>
        {field.normal && <span>normal {field.normal[0]}–{field.normal[1]}</span>}
        <span>{field.max}</span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Type or drag</p>
    </div>
  );
};

export const ChoiceChips = ({ label, options, value, onChange, testid, multi = false }) => {
  const arr = multi ? (Array.isArray(value) ? value : []) : null;
  const isOn = (o) => (multi ? arr.includes(o) : value === o);
  const toggle = (o) => {
    if (multi) onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
    else onChange(value === o ? "" : o);
  };
  if (multi) {
    return (
      <Field label={label}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid={testid}>
          {options.map((o) => {
            const active = isOn(o);
            return (
              <button
                key={o}
                type="button"
                data-testid={`${testid}-${String(o).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                onClick={() => toggle(o)}
                className={`flex min-h-11 items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm font-medium transition-colors ${
                  active ? "border-primary/40 bg-secondary text-foreground" : "border-border bg-white hover:bg-muted/60"
                }`}
              >
                <span className={`grid h-[1.125rem] w-[1.125rem] shrink-0 place-items-center rounded border ${active ? "border-primary bg-primary text-white" : "border-input bg-white"}`}>
                  {active && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="min-w-0 leading-snug">{o}</span>
              </button>
            );
          })}
        </div>
      </Field>
    );
  }
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-2.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            data-testid={`${testid}-${String(o).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            onClick={() => toggle(o)}
            className={`min-h-12 min-w-[4.5rem] rounded-lg border px-5 text-sm font-bold transition-colors ${
              isOn(o) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white text-foreground hover:bg-muted"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </Field>
  );
};

/** Chips (multi) + free-text "add other" for e.g. chief complaints, allergies. */
export const ChipMultiWithOther = ({ label, options, value = [], onChange, testid, placeholder = "Add other…" }) => {
  const [other, setOther] = useState("");
  const custom = value.filter((v) => !options.includes(v));
  const toggle = (o) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  const addOther = () => { const t = other.trim(); if (t && !value.includes(t)) onChange([...value, t]); setOther(""); };
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o} type="button" data-testid={`${testid}-${String(o).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} onClick={() => toggle(o)}
            className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${value.includes(o) ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-muted"}`}>{o}</button>
        ))}
        {custom.map((c) => (
          <button key={c} type="button" data-testid={`${testid}-custom-${c.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} onClick={() => toggle(c)}
            className="min-h-10 rounded-full border border-primary bg-secondary px-4 text-sm font-semibold">{c} ✕</button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input data-testid={`${testid}-other-input`} value={other} onChange={(e) => setOther(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOther())} placeholder={placeholder} className="h-10 flex-1 rounded-md border border-input bg-white px-3 text-sm" />
        <Button type="button" variant="outline" className="h-10" data-testid={`${testid}-other-add`} onClick={addOther}>Add</Button>
      </div>
    </Field>
  );
};

export const YesNo = ({ label, value, onChange, testid }) => (
  <Field label={label}>
    <div className="flex flex-wrap gap-2.5">
      {["Yes", "No"].map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            type="button"
            data-testid={`${testid}-${o.toLowerCase()}`}
            onClick={() => onChange(active ? "" : o)}
            className={`min-h-12 min-w-[4.5rem] rounded-lg border px-5 text-sm font-bold transition-colors ${
              active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white text-foreground hover:bg-muted"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  </Field>
);

export const MiniFieldRenderer = ({ fields, data, onChange, prefix }) => (
  <div className="grid gap-4 sm:grid-cols-2">
    {fields.map((f) => {
      const set = (v) => onChange({ ...data, [f.k]: v });
      const val = data[f.k];
      if (f.type === "choice") return <SelectField key={f.k} label={f.label} options={f.options} value={val || ""} onChange={set} testid={`${prefix}-${f.k}`} />;
      if (f.type === "yesno") return <div key={f.k}><YesNo label={f.label} value={val} onChange={set} testid={`${prefix}-${f.k}`} /></div>;
      if (f.type === "checks") return <div key={f.k} className="sm:col-span-2"><ChoiceChips multi label={f.label} options={f.options} value={val || []} onChange={set} testid={`${prefix}-${f.k}`} /></div>;
      if (f.type === "textarea") return <div key={f.k} className="sm:col-span-2"><AreaField label={f.label} rows={3} testid={`${prefix}-${f.k}`} value={val || ""} onChange={(e) => set(e.target.value)} /></div>;
      return <TextField key={f.k} label={f.label} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} testid={`${prefix}-${f.k}`} value={val || ""} onChange={(e) => set(e.target.value)} />;
    })}
  </div>
);

/** Full entry-view shell: sidebar + collapsible sections + progress + save bar. */
export const ConditionEntryShell = ({ patient, patientEncs, sidebarDiseases, title, context, sections, onSave, savedAt, backTo, preface }) => {
  const [open, setOpen] = useState({});
  const doneCount = sections.filter((s) => s.done).length;
  return (
    <AppShell>
      <div className="grid gap-6 pb-28 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <PatientSidebar patient={patient} encounters={patientEncs} diseases={sidebarDiseases} testid="cond-lhs-panel" />
        <div className="min-w-0 space-y-4">
          <div className="sticky top-[65px] z-30 -mx-1 flex flex-wrap items-center gap-3 bg-background px-1 py-3 lg:top-[69px]">
            <div className="min-w-0 flex-1">
              <p className="font-head text-xl font-bold tracking-tight sm:text-2xl">{title}</p>
              <p className="text-xs text-muted-foreground" data-testid="cond-context">{context}</p>
            </div>
            <Button variant="outline" className="h-11 shrink-0" data-testid="cond-exit-btn" onClick={() => backTo()}><ArrowLeft className="mr-2 h-4 w-4" /> Exit to record</Button>
          </div>
          <div className="rounded-lg border border-border bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">Visit completeness</p>
              <span className="text-sm font-semibold" data-testid="cond-completeness">{doneCount} of {sections.length} sections captured</span>
            </div>
            <Progress value={(doneCount / sections.length) * 100} className="mt-3 h-2.5" />
          </div>
          {preface}
          {sections.map((s, i) => (
            <section key={i} className="rounded-lg border border-border bg-white" data-testid={`cond-section-${i + 1}`}>
              <button type="button" data-testid={`cond-section-toggle-${i + 1}`} onClick={() => setOpen((o) => ({ ...o, [i]: o[i] === false }))} className="flex w-full items-center gap-3 px-5 py-4 text-left">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md text-sm font-bold ${s.done ? "bg-green-50 text-green-700" : "bg-secondary text-primary"}`}>{s.done ? <CircleCheck className="h-5 w-5" /> : i + 1}</span>
                <span className="flex-1"><span className="block font-head text-lg font-semibold tracking-tight">{s.title}</span><span className="block text-xs text-muted-foreground">{s.done ? "Captured" : "Not started"}</span></span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open[i] !== false ? "rotate-180" : ""}`} />
              </button>
              {open[i] !== false && <div className="border-t border-border p-5">{s.body}</div>}
            </section>
          ))}
        </div>
      </div>
      <div className="fixed bottom-16 left-0 right-0 z-30 border-t border-border bg-white lg:bottom-0">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 sm:px-6">
          <span className="hidden text-xs text-muted-foreground sm:block" data-testid="cond-saved-indicator">{savedAt ? `Last saved: ${savedAt}` : "Draft — not saved yet"}</span>
          <div className="ml-auto flex flex-1 gap-3 sm:flex-none">
            <Button variant="outline" className="h-12 flex-1 sm:flex-none sm:px-8" data-testid="cond-save-btn" onClick={() => onSave(false)}><Save className="mr-2 h-4 w-4" /> Save</Button>
            <Button className="h-12 flex-1 text-base sm:flex-none sm:px-8" data-testid="cond-save-close-btn" onClick={() => onSave(true)}><Check className="mr-2 h-4 w-4" /> Save &amp; close</Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export const FeatureCard = ({ title, count, lastAt, children, testid, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-lg border border-border bg-white" data-testid={testid}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left" data-testid={`${testid}-toggle`}>
        <h2 className="min-w-0 flex-1 font-head text-lg font-semibold">{title}</h2>
        {lastAt && <span className="truncate text-xs font-medium text-muted-foreground">{lastAt}</span>}
        {count != null && <span className="rounded border border-border px-2 py-0.5 text-xs">{count} entr{count === 1 ? "y" : "ies"}</span>}
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-border p-4">{children}</div>}
    </section>
  );
};
