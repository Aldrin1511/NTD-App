import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, TextField, AreaField, SelectField, ChoiceRow, CheckGrid, AlertPanel, ItemActions } from "@/components/Fields";
import { RELATIONSHIPS, CONTACT_STATUS, CONSENT, AGE_SEX_GROUPS, fmtDate, localISODate, parseDate } from "@/mock/specs";
import { Plus, Trash2, Check } from "lucide-react";
import BodySilhouette from "@/components/BodySilhouette";
import LfStageHelp from "@/components/LfStageHelp";
import LeprosyHouseholdMonitoring from "@/components/LeprosyHouseholdMonitoring";
import { mdtAdherenceConfig } from "@/components/LeprosyMedications";
import {
  SensoryTestingChart,
  VmtChart,
  VisionAcuityChart,
  applyVmtChart,
  applySensoryChart,
  applyVisionChart,
} from "@/components/LeprosyReactionCharts";
import { toast } from "sonner";

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const FormRenderer = ({ fields, data, onChange, prefix = "f", gender, sourcePatient }) => {
  const set = (k) => (v) => onChange({ ...data, [k]: v });
  const patientGender = gender || "";
  const selectedComplaints = (key) => Object.keys(data[key] || {}).filter((c) => data[key][c] != null);

  const visible = fields.filter((f) => {
    if (f.type === "section") return true;
    if (f.when && data[f.when[0]] !== f.when[1]) return false;
    if (f.whenAll && f.whenAll.some(([k, val]) => data[k] !== val)) return false;
    if (f.whenIncludes && !(Array.isArray(data[f.whenIncludes[0]]) && data[f.whenIncludes[0]].includes(f.whenIncludes[1]))) return false;
    if (f.whenIncludesAny) {
      const [src, opts] = f.whenIncludesAny;
      const selected = selectedComplaints(src);
      if (!opts.some((o) => selected.includes(o))) return false;
    }
    if (f.whenHasAny && selectedComplaints(f.whenHasAny).length === 0) return false;
    if (f.whenGender && patientGender !== f.whenGender) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      {visible.map((f) => {
        const id = `${prefix}-${slug(f.k)}`;
        const v = data[f.k];
        if (f.type === "section") {
          return (
            <div key={f.k} className="border-b border-border pb-2 pt-2 first:pt-0" data-testid={id}>
              <h3 className="font-head text-base font-bold tracking-tight text-foreground">{f.label}</h3>
            </div>
          );
        }
        if (f.type === "note") {
          return <AlertPanel key={f.k} level="info" title="Note" testid={id}>{f.label}</AlertPanel>;
        }
        if (f.type === "text") return <TextField key={f.k} label={f.label} testid={id} value={v || ""} onChange={(e) => set(f.k)(e.target.value)} />;
        if (f.type === "number") return <TextField key={f.k} label={f.label} type="number" testid={id} value={v ?? ""} onChange={(e) => set(f.k)(e.target.value)} />;
        if (f.type === "date") return <TextField key={f.k} label={f.label} type="date" testid={id} value={v || ""} onChange={(e) => set(f.k)(e.target.value)} hint={v ? fmtDate(v) : undefined} />;
        if (f.type === "textarea") return <AreaField key={f.k} label={f.label} rows={3} testid={id} value={v || ""} onChange={(e) => set(f.k)(e.target.value)} />;
        if (f.type === "select") return <SelectField key={f.k} label={f.label} options={f.options} value={v} onChange={set(f.k)} testid={id} />;
        if (f.type === "yesno") return <ChoiceRow key={f.k} label={f.label} options={["Yes", "No"]} value={v} onChange={set(f.k)} testid={id} />;
        if (f.type === "choice") return <ChoiceRow key={f.k} label={f.label} options={f.options} value={v} onChange={set(f.k)} testid={id} />;
        if (f.type === "checks") return <CheckGrid key={f.k} label={f.label} options={f.options} value={v || []} onChange={set(f.k)} testid={id} cols="sm:grid-cols-2" />;
        if (f.type === "duration") return <Duration key={f.k} label={f.label} value={v || {}} onChange={set(f.k)} id={id} />;
        if (f.type === "lines") return <Lines key={f.k} label={f.label} value={v || []} onChange={set(f.k)} id={id} placeholder={f.placeholder} />;
        if (f.type === "repeatChoice") {
          return (
            <RepeatChoice
              key={f.k}
              label={f.label}
              options={f.options}
              value={v || []}
              onChange={set(f.k)}
              id={id}
              addLabel={f.addLabel}
              dateLabel={f.dateLabel}
            />
          );
        }
        if (f.type === "perComplaint") {
          return (
            <PerComplaint
              key={f.k}
              label={f.label}
              options={f.options}
              fields={f.fields}
              value={v || {}}
              onChange={set(f.k)}
              id={id}
              prefix={id}
            />
          );
        }
        if (f.type === "groupCount") {
          const all = visible.filter((x) => x.type === "groupCount");
          if (f.k !== all[0]?.k) return null;
          return (
            <HouseholdCountTable
              key="hh-count-table"
              questions={all}
              data={data}
              onChange={(k, next) => set(k)(next)}
              prefix={prefix}
            />
          );
        }
        if (f.type === "contactTable") return <ContactTable key={f.k} label={f.label} value={v || []} onChange={set(f.k)} id={id} prophylaxis={f.prophylaxis} />;
        if (f.type === "leprosyHousehold") return <LeprosyHouseholdMonitoring key={f.k} value={v || []} onChange={set(f.k)} id={id} sourcePatient={sourcePatient} />;
        if (f.type === "leprosyVmtChart") {
          return (
            <VmtChart
              key={f.k}
              id={id}
              value={v || {}}
              onChange={(chart) => onChange(applyVmtChart(data, chart))}
            />
          );
        }
        if (f.type === "leprosySensoryChart") {
          return (
            <SensoryTestingChart
              key={f.k}
              id={id}
              value={v || {}}
              onChange={(chart) => onChange(applySensoryChart(data, chart))}
            />
          );
        }
        if (f.type === "leprosyVisionChart") {
          return (
            <VisionAcuityChart
              key={f.k}
              id={id}
              value={v || {}}
              onChange={(chart) => onChange(applyVisionChart(data, chart))}
            />
          );
        }
        return null;
      })}
    </div>
  );
};

const NestedFields = ({ fields, data, onChange, prefix }) => {
  const set = (k) => (v) => onChange({ ...data, [k]: v });
  const visible = fields.filter((f) => {
    if (f.type === "note") return !f.when || data[f.when[0]] === f.when[1];
    if (f.when && data[f.when[0]] !== f.when[1]) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {visible.map((f) => {
        const id = `${prefix}-${slug(f.k)}`;
        const v = data[f.k];
        if (f.type === "note") return <AlertPanel key={f.k} level="info" title="Note" testid={id}>{f.label}</AlertPanel>;
        if (f.type === "text") return <TextField key={f.k} label={f.label} testid={id} value={v || ""} onChange={(e) => set(f.k)(e.target.value)} />;
        if (f.type === "textarea") return <AreaField key={f.k} label={f.label} rows={3} testid={id} value={v || ""} onChange={(e) => set(f.k)(e.target.value)} />;
        if (f.type === "yesno") return <ChoiceRow key={f.k} label={f.label} options={["Yes", "No"]} value={v} onChange={set(f.k)} testid={id} />;
        if (f.type === "duration") return <Duration key={f.k} label={f.label} value={v || {}} onChange={set(f.k)} id={id} />;
        if (f.type === "lines") return <Lines key={f.k} label={f.label} value={v || []} onChange={set(f.k)} id={id} placeholder={f.placeholder} />;
        return null;
      })}
    </div>
  );
};

const PerComplaint = ({ label, options, fields, value, onChange, id, prefix }) => {
  const selected = options.filter((o) => value[o] != null);

  return (
    <div className="space-y-5" data-testid={id}>
      <CheckGrid label={label} options={options} value={selected} onChange={(next) => {
        const map = {};
        next.forEach((o) => {
          map[o] = value[o] != null ? value[o] : {};
        });
        onChange(map);
      }} testid={`${id}-select`} cols="sm:grid-cols-2" />
      {selected.length === 0 && (
        <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
          Select one or more complaints to capture details for each.
        </p>
      )}
      {selected.map((complaint) => (
        <div key={complaint} className="space-y-4 rounded-md border border-border bg-white p-4" data-testid={`${id}-block-${slug(complaint)}`}>
          <h4 className="font-semibold text-foreground">{complaint}</h4>
          <NestedFields
            fields={fields}
            data={value[complaint] || {}}
            onChange={(block) => onChange({ ...value, [complaint]: block })}
            prefix={`${prefix}-${slug(complaint)}`}
          />
        </div>
      ))}
    </div>
  );
};

const emptyLabEntry = (withDate) => (withDate ? { result: "", date: "" } : "");

const normalizeLabEntries = (value, withDate) => {
  const list = Array.isArray(value) && value.length ? value : [emptyLabEntry(withDate)];
  if (!withDate) return list.map((x) => (typeof x === "string" ? x : x?.result || ""));
  return list.map((x) => (typeof x === "string" ? { result: x, date: "" } : { result: x?.result || "", date: x?.date || "" }));
};

const RepeatChoice = ({ label, options, value, onChange, id, addLabel = "Add", dateLabel }) => {
  const withDate = Boolean(dateLabel);
  const entries = normalizeLabEntries(value, withDate);
  const update = (i, patch) => {
    const list = [...entries];
    list[i] = withDate ? { ...entries[i], ...patch } : patch;
    onChange(list);
  };
  const remove = (i) => {
    if (entries.length <= 1) return onChange([emptyLabEntry(withDate)]);
    onChange(entries.filter((_, j) => j !== i));
  };

  return (
    <Field label={label} hint="Add another result to repeat this assessment">
      <div className="space-y-4" data-testid={`${id}-list`}>
        {entries.map((entry, i) => {
          const result = withDate ? entry.result : entry;
          const date = withDate ? entry.date : "";
          return (
            <div key={i} className="rounded-md border border-border bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  Result {i + 1}
                </p>
                <ItemActions
                  onAdd={() => {
                    const next = [...entries];
                    next.splice(i + 1, 0, emptyLabEntry(withDate));
                    onChange(next);
                  }}
                  addTestid={`${id}-add-${i}`}
                  canRemove={entries.length > 1}
                  onRemove={() => remove(i)}
                  removeTestid={`${id}-remove-${i}`}
                />
              </div>
              <div className="space-y-4">
                <ChoiceRow
                  label="Result"
                  options={options}
                  value={result}
                  onChange={(v) => update(i, withDate ? { result: v } : v)}
                  testid={`${id}-${i}`}
                />
                {withDate && (
                  <TextField
                    label={dateLabel}
                    type="date"
                    testid={`${id}-date-${i}`}
                    value={date}
                    onChange={(e) => update(i, { date: e.target.value })}
                    hint={date ? fmtDate(date) : undefined}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Field>
  );
};

const Duration = ({ label, value, onChange, id }) => (
  <Field label={label}>
    <div className="flex flex-wrap gap-2">
      <Input type="number" className="h-12 w-28 bg-white text-base" data-testid={`${id}-num`} value={value.n ?? ""} onChange={(e) => onChange({ ...value, n: e.target.value })} />
      {["Weeks", "Months", "Years"].map((u) => (
        <button key={u} type="button" data-testid={`${id}-${u.toLowerCase()}`} onClick={() => onChange({ ...value, unit: u })}
          className={`h-12 rounded-md border px-4 text-sm font-semibold ${value.unit === u ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-muted"}`}>{u}</button>
      ))}
    </div>
  </Field>
);

const Lines = ({ label, value, onChange, id, placeholder }) => {
  const [t, setT] = useState("");
  return (
    <Field label={label}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input className="h-12 w-full min-w-0 bg-white text-base" placeholder={placeholder} data-testid={`${id}-input`} value={t} onChange={(e) => setT(e.target.value)} />
        <Button type="button" variant="outline" className="h-12" data-testid={`${id}-add`} onClick={() => { if (t.trim()) { onChange([...value, t.trim()]); setT(""); } }}>
          <Plus className="mr-2 h-4 w-4" /> Add
        </Button>
      </div>
      {value.length > 0 && (
        <ul className="space-y-2" data-testid={`${id}-list`}>
          {value.map((x, i) => (
            <li key={i} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
              <span className="flex-1">{x}</span>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-600" onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
};

const parseHhGroup = (g) => {
  const sex = /^Female/i.test(g) ? "Female" : /^Male/i.test(g) ? "Male" : "";
  const band = /Below 15|Child/i.test(g)
    ? "Below 15 Years"
    : /15 Years and Above|15y\+|Adult/i.test(g)
      ? "15 Years and Above"
      : g;
  return { key: g, sex, band };
};

export const HouseholdCountTable = ({ questions = [], data = {}, onChange, readOnly = false, prefix = "hh" }) => {
  const groups = questions[0]?.options || AGE_SEX_GROUPS;
  const parsed = groups.map(parseHhGroup);
  const bands = [...new Set(parsed.map((p) => p.band))].sort((a, b) => {
    const rank = (x) => (/Below 15/i.test(x) ? 0 : 1);
    return rank(a) - rank(b);
  });
  const sexes = [...new Set(parsed.map((p) => p.sex).filter(Boolean))].sort((a, b) => (a === "Male" ? 0 : 1) - (b === "Male" ? 0 : 1));
  const twoLevel = sexes.length === 2 && parsed.every((p) => p.sex);
  const columns = twoLevel
    ? bands.flatMap((band) => sexes.map((sex) => parsed.find((p) => p.band === band && p.sex === sex)?.key).filter(Boolean))
    : groups;

  const cellValue = (qk, g) => {
    const raw = data[qk]?.[g];
    if (raw === "" || raw == null) return "";
    return raw;
  };
  const rowSum = (qk) => groups.reduce((a, g) => a + (Number(data[qk]?.[g]) || 0), 0);

  return (
    <div className="overflow-x-auto" data-testid={`${prefix}-count-table`}>
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          {twoLevel ? (
            <>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-semibold" rowSpan={2}>Question</th>
                {bands.map((band) => (
                  <th key={band} colSpan={sexes.length} className="py-2 px-2 text-center font-semibold">{band}</th>
                ))}
                <th className="py-2 pl-3 font-semibold" rowSpan={2}>Total</th>
              </tr>
              <tr className="border-b border-border text-xs text-muted-foreground">
                {bands.flatMap((band) => sexes.map((sex) => (
                  <th key={`${band}-${sex}`} className="py-1 px-2 text-center font-semibold">{sex}</th>
                )))}
              </tr>
            </>
          ) : (
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-semibold">Question</th>
              {groups.map((g) => (
                <th key={g} className="py-2 px-2 text-center font-semibold">{g}</th>
              ))}
              <th className="py-2 pl-3 font-semibold">Total</th>
            </tr>
          )}
        </thead>
        <tbody>
          {questions.map((q) => (
            <tr key={q.k} className="border-b border-border/70 align-top">
              <td className="py-2 pr-3">
                <span className="font-medium">{q.label}</span>
                {q.note ? <p className="mt-1 text-[11px] font-normal leading-snug text-muted-foreground">{q.note}</p> : null}
              </td>
              {columns.map((g) => (
                <td key={`${q.k}-${g}`} className="py-2 px-2 text-center">
                  {readOnly ? (
                    <span className="font-medium">{cellValue(q.k, g) === "" ? "—" : cellValue(q.k, g)}</span>
                  ) : (
                    <Input
                      type="number"
                      min="0"
                      className="mx-auto h-11 w-[4.5rem] bg-white text-center text-base"
                      data-testid={`${prefix}-${slug(q.k)}-${slug(g)}`}
                      value={cellValue(q.k, g)}
                      onChange={(e) => onChange?.(q.k, { ...(data[q.k] || {}), [g]: e.target.value })}
                    />
                  )}
                </td>
              ))}
              <td className="py-2 pl-3 font-semibold">{rowSum(q.k)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ContactTable = ({ label, value, onChange, id, prophylaxis = ["None"] }) => {
  const add = () => onChange([...value, { name: "", age: "", sex: "Male", rel: "Household member", status: "Asymptomatic", consent: "No", prophylaxis: "None", date: new Date().toISOString().slice(0, 10) }]);
  const upd = (i, k, v) => onChange(value.map((c, j) => (j === i ? { ...c, [k]: v } : c)));
  return (
    <Field label={`${label} (${value.length})`}>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[880px] text-sm" data-testid={`${id}-table`}>
          <thead className="bg-muted">
            <tr>{["#", "Name", "Age", "Gender", "Relationship", "Status", "Prophylaxis consented", "Prophylaxis taken", "Date", ""].map((h) => (
              <th key={h} className="p-2 text-left font-semibold">{h}</th>))}</tr>
          </thead>
          <tbody>
            {value.length === 0 && <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">No contacts added yet.</td></tr>}
            {value.map((c, i) => (
              <tr key={i} className="border-t border-border">
                <td className="p-2 font-semibold">{i + 1}</td>
                <td className="p-2"><Input className="h-10 w-36 bg-white" data-testid={`${id}-name-${i}`} value={c.name} onChange={(e) => upd(i, "name", e.target.value)} /></td>
                <td className="p-2"><Input type="number" className="h-10 w-16 bg-white" data-testid={`${id}-age-${i}`} value={c.age} onChange={(e) => upd(i, "age", e.target.value)} /></td>
                {[["sex", ["Male", "Female", "Others"]], ["rel", RELATIONSHIPS], ["status", CONTACT_STATUS], ["consent", CONSENT], ["prophylaxis", prophylaxis]].map(([k, opts]) => (
                  <td key={k} className="p-2">
                    <select className="h-10 rounded-md border border-input bg-white px-2 text-sm" data-testid={`${id}-${k}-${i}`} value={c[k]} onChange={(e) => upd(i, k, e.target.value)}>
                      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                ))}
                <td className="p-2 whitespace-nowrap">{fmtDate(c.date)}</td>
                <td className="p-2"><Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-600" data-testid={`${id}-remove-${i}`} onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" className="h-12" data-testid={`${id}-add-contact`} onClick={add}><Plus className="mr-2 h-4 w-4" /> Add contact</Button>
    </Field>
  );
};

export const NERVE_FINDING_CODES = ["G", "H", "I"];

export const DiseaseBodyChart = ({ spec, marks, onChange, sex = "Male" }) => {
  const [code, setCode] = useState(spec.bodyChart.codes[0][0]);
  const bodySex = sex === "Female" ? "Female" : "Male";
  const per = spec.bodyChart.perLesion;
  const views = spec.bodyChart.views || ["front"];
  const nerveMode = Boolean(spec.bodyChart.showNerves) && NERVE_FINDING_CODES.includes(code);
  const defaultExtra = per?.default || (per ? per.options[0] : undefined);

  const place = (view) => (label) => {
    const key = `${view}:${label}`;
    if (marks[key]?.code === code) { const n = { ...marks }; delete n[key]; return onChange(n); }
    onChange({
      ...marks,
      [key]: {
        region: label,
        view,
        code,
        label: spec.bodyChart.codes.find((c) => c[0] === code)?.[1],
        ...(per ? { extra: marks[key]?.extra || defaultExtra } : {}),
      },
    });
  };

  const entries = Object.entries(marks);

  return (
    <div className="space-y-4">
      {spec.bodyChart.stageHelp && (
        <div className="flex justify-end">
          <LfStageHelp />
        </div>
      )}

      <Field label="1. Choose the finding, 2. click the body part">
        <div className="flex flex-wrap gap-2">
          {spec.bodyChart.codes.map(([c, lbl]) => (
            <button key={c} type="button" data-testid={`lesion-code-${c}`} onClick={() => setCode(c)}
              className={`h-11 max-w-full rounded-md border px-3 text-left text-sm font-semibold ${code === c ? "border-primary bg-primary text-white" : "border-border bg-white"}`}>
              <b>{c}</b> — {lbl}
            </button>
          ))}
        </div>
      </Field>

      <div className={`grid gap-4 ${views.length > 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
        {views.map((v) => (
          <div key={v} className="rounded-lg border border-border bg-muted/30 p-3" data-testid={`body-view-panel-${v}`}>
            <p className="mb-2 text-center text-xs font-semibold text-muted-foreground">{v} view</p>
            <BodySilhouette sex={bodySex} view={v} marks={marks} onPlace={place(v)} showNerves={nerveMode} nerveOnly={nerveMode} />
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Hover a body section to highlight it · click to tag <b>{code}</b> · click again to clear
        {nerveMode ? " · yellow markers are peripheral nerves — tag G, H or I on a nerve only" : ""}
        {per ? ` · set ${per.label || "details"} on each finding` : ""}
      </p>

      <Field label={`Recorded findings (${entries.length})`}>
        {entries.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No findings marked yet.</p>
        ) : (
          <ul className="space-y-2" data-testid="lesion-list">
            {entries.map(([k, m]) => (
              <li key={k} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-white p-3 text-sm">
                <span className="font-semibold">{m.region}</span>
                <span className="text-xs text-muted-foreground">{m.view}</span>
                <span className="rounded bg-secondary px-2 py-0.5 text-xs font-bold text-primary">{m.code} · {m.label}</span>
                {per && (
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <span className="text-xs font-semibold text-muted-foreground">{per.label}</span>
                    {per.options.map((o) => (
                      <button key={o} type="button" data-testid={`per-${slug(k)}-${slug(o)}`} onClick={() => onChange({ ...marks, [k]: { ...m, extra: o } })}
                        className={`h-9 rounded-md border px-2 text-xs font-semibold ${(m.extra || defaultExtra) === o ? "border-primary bg-primary text-white" : "border-border bg-white"}`}>{o}</button>
                    ))}
                  </div>
                )}
                <Button type="button" variant="ghost" size="icon" className="ml-auto h-9 w-9 text-red-600" data-testid={`remove-lesion-${slug(k)}`}
                  onClick={() => { const n = { ...marks }; delete n[k]; onChange(n); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Field>
    </div>
  );
};

const emptyExamRound = () => ({ marks: {}, secondaryInfection: "", assessment: {} });

export const normalizeExamRounds = (data = {}) => {
  if (Array.isArray(data.examRounds) && data.examRounds.length) return data.examRounds;
  const hasMarks = data.marks && Object.keys(data.marks).length > 0;
  const hasSi = data.assessment?.secondaryInfection;
  if (hasMarks || hasSi) {
    return [{ marks: data.marks || {}, secondaryInfection: data.assessment?.secondaryInfection || "" }];
  }
  return [emptyExamRound()];
};

export const mergedExamMarks = (rounds = []) =>
  rounds.reduce((acc, round, i) => {
    Object.entries(round.marks || {}).forEach(([k, v]) => {
      acc[`${i}:${k}`] = v;
    });
    return acc;
  }, {});

/** Repeatable body exam rounds (Yaws / LF / Buruli / Leprosy). */
export const RepeatableBodyExam = ({ spec, value, onChange, sex = "Male" }) => {
  const rounds = value?.length ? value : [emptyExamRound()];
  const showRoundSi = !spec.bodyChart?.perLesion && !spec.repeatExamIncludesAssessment;
  const includeAssessment = Boolean(spec.repeatExamIncludesAssessment && spec.assessmentExtra?.length);
  const update = (i, patch) => {
    const next = rounds.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onChange(next);
  };
  const remove = (i) => {
    if (rounds.length <= 1) return onChange([emptyExamRound()]);
    onChange(rounds.filter((_, j) => j !== i));
  };

  return (
    <div className="space-y-6" data-testid="repeatable-exam">
      {rounds.map((round, i) => (
        <div key={i} className="space-y-4 rounded-lg border border-border bg-white p-4" data-testid={`exam-round-${i}`}>
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-head text-base font-semibold tracking-tight">Assessment {i + 1}</h4>
            <ItemActions
              onAdd={() => {
                const next = [...rounds];
                next.splice(i + 1, 0, emptyExamRound());
                onChange(next);
              }}
              addTestid={`exam-round-add-${i}`}
              canRemove={rounds.length > 1}
              onRemove={() => remove(i)}
              removeTestid={`exam-round-remove-${i}`}
            />
          </div>
          <DiseaseBodyChart
            spec={spec}
            marks={round.marks || {}}
            onChange={(marks) => update(i, { marks })}
            sex={sex}
          />
          {includeAssessment && (
            <FormRenderer
              fields={spec.assessmentExtra}
              data={round.assessment || {}}
              onChange={(assessment) => update(i, { assessment })}
              prefix={`exam-${i}-assess`}
            />
          )}
          {showRoundSi && (
            <ChoiceRow
              label="Secondary infection?"
              options={["Yes", "No"]}
              value={round.secondaryInfection}
              onChange={(v) => update(i, { secondaryInfection: v })}
              testid={`exam-round-si-${i}`}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export const LeprosyExamSummary = ({ classification, patches, nerves, scores, onAccept }) => {
  if (!classification) return null;
  return (
    <div className="space-y-4 rounded-lg border border-primary/30 bg-secondary/30 p-4" data-testid="leprosy-exam-summary">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Classification (from examination)</p>
          <p className="mt-1 font-head text-xl font-bold tracking-tight" data-testid="leprosy-classification">{classification}</p>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="leprosy-counts">
            Patches: <b>{patches}</b> · Nerves affected: <b>{nerves}</b>
          </p>
        </div>
        {onAccept && (
          <Button type="button" className="h-11" data-testid="leprosy-accept-classification" onClick={() => onAccept(classification)}>
            Use as diagnosis
          </Button>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-muted-foreground">EHF disability table</p>
        <div className="overflow-x-auto rounded-md border border-border bg-white">
          <table className="w-full text-sm" data-testid="ehf-table">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3">Site</th>
                <th className="p-3">Right (0–2)</th>
                <th className="p-3">Left (0–2)</th>
                <th className="p-3">WHO grade</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Eyes", scores.rightEye, scores.leftEye, scores.eyeGrade],
                ["Hands", scores.rightHand, scores.leftHand, scores.handGrade],
                ["Feet", scores.rightFoot, scores.leftFoot, scores.footGrade],
              ].map(([site, right, left, grade]) => (
                <tr key={site} className="border-t border-border">
                  <td className="p-3 font-semibold">{site}</td>
                  <td className="p-3">{right}</td>
                  <td className="p-3">{left}</td>
                  <td className="p-3">{grade}</td>
                </tr>
              ))}
              <tr className="border-t border-border bg-muted/30">
                <td className="p-3 font-bold">EHF score</td>
                <td className="p-3 font-bold" colSpan={3} data-testid="ehf-score">{scores.ehf} / 12</td>
              </tr>
              <tr className="border-t border-border">
                <td className="p-3 font-bold">WHO G2D scale</td>
                <td className="p-3 font-bold" colSpan={3} data-testid="who-g2d">Grade {scores.g2d}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const cycleAdherence = (st) => (st === true ? false : st === false ? undefined : true);

const normalizeLeprosyAdherence = (value, diagnosis, fallbackStart) => {
  const cfg = mdtAdherenceConfig(diagnosis);
  if (value?.lines && Array.isArray(value.lines) && value.lines.length) {
    return {
      lines: value.lines.map((line) => ({
        ...line,
        count: line.count || cfg.checkboxMonths,
        regimen: line.regimen || cfg.regimen,
        months: line.months || {},
        startDate: line.startDate || fallbackStart || localISODate(),
      })),
    };
  }
  // Migrate legacy flat { 0: true, count: 12 }
  if (value && (value.count != null || Object.keys(value).some((k) => /^\d+$/.test(k)))) {
    const months = {};
    Object.keys(value).forEach((k) => {
      if (/^\d+$/.test(k)) months[k] = value[k];
    });
    return {
      lines: [
        {
          id: value.id || "mdt-legacy",
          startDate: fallbackStart || localISODate(),
          regimen: cfg.regimen || "MB",
          count: Number(value.count) || cfg.checkboxMonths,
          months,
        },
      ],
    };
  }
  return { lines: [] };
};

const LeprosyMdtAdherence = ({ value = {}, onChange, startDate, diagnosis, readOnly = false }) => {
  const cfg = mdtAdherenceConfig(diagnosis);
  const normalized = normalizeLeprosyAdherence(value, diagnosis, startDate);
  const lines = normalized.lines;

  useEffect(() => {
    if (readOnly) return;
    if (value?.lines?.length) {
      // Keep regimen/count in sync when diagnosis flips on the latest line if still empty
      const latest = value.lines[value.lines.length - 1];
      if (latest && (!latest.regimen || latest.regimen !== cfg.regimen) && Object.keys(latest.months || {}).length === 0) {
        onChange({
          lines: value.lines.map((l, i) =>
            i === value.lines.length - 1
              ? { ...l, regimen: cfg.regimen, count: cfg.checkboxMonths }
              : l,
          ),
        });
      }
      return;
    }
    if (value && (value.count != null || Object.keys(value).some((k) => /^\d+$/.test(k)))) {
      onChange(normalizeLeprosyAdherence(value, diagnosis, startDate));
      return;
    }
    onChange({
      lines: [
        {
          id: `mdt-${Date.now()}`,
          startDate: startDate || localISODate(),
          regimen: cfg.regimen,
          count: cfg.checkboxMonths,
          months: {},
        },
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.regimen, diagnosis, readOnly]);

  const commit = (nextLines) => onChange({ lines: nextLines });

  const updateLine = (lineId, patch) => {
    commit(lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)));
  };

  const setMonth = (lineId, i, next) => {
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;
    const months = { ...(line.months || {}) };
    if (next === undefined) delete months[i];
    else months[i] = next;
    updateLine(lineId, { months });
  };

  const restart = (line) => {
    const missed = Object.values(line.months || {}).filter((v) => v === false).length;
    const nextLine = {
      id: `mdt-${Date.now()}`,
      startDate: localISODate(),
      regimen: cfg.regimen || line.regimen,
      count: cfg.checkboxMonths,
      months: {},
      restartedFrom: line.id,
      restartedAt: localISODate(),
    };
    commit([...lines, nextLine]);
    toast.success(
      missed
        ? `New MDT adherence line started (${missed} months not taken retained above)`
        : "New MDT adherence line started — previous line retained",
    );
  };

  if (!cfg.regimen && !lines.length) {
    return (
      <AlertPanel level="info" title="MDT adherence" testid="mdt-adherence-need-dx">
        Select a PB or MB diagnosis to generate the month-wise MDT supply schedule (PB: 6 months / 9 checkboxes; MB: 12 months / 18 checkboxes).
      </AlertPanel>
    );
  }

  const displayLines = (!lines.length && readOnly && cfg.regimen)
    ? [{
        id: "mdt-readonly",
        startDate: startDate || "",
        regimen: cfg.regimen,
        count: cfg.checkboxMonths,
        months: {},
      }]
    : lines;

  if (!displayLines.length) {
    return <p className="text-sm text-muted-foreground">Preparing MDT adherence schedule…</p>;
  }

  return (
    <div className="space-y-5" data-testid="leprosy-mdt-adherence">
      <div>
        <p className="text-xs font-semibold text-muted-foreground">Drug adherence — MDT</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {cfg.regimen ? `${cfg.regimen} course ${cfg.courseMonths} months · showing ${cfg.checkboxMonths} month checkboxes.` : "MDT month-wise drug adherence."}
          {readOnly ? "" : ` Tap: empty → taken (green) → not taken (red) → empty. Restart is highlighted after more than ${cfg.restartMissed} months not taken.`}
        </p>
      </div>

      {displayLines.map((line, lineIdx) => {
        const lineCfg = mdtAdherenceConfig(
          line.regimen === "PB" ? "Paucibacillary (PB)" : line.regimen === "MB" ? "Multibacillary (MB)" : diagnosis,
        );
        const count = Number(line.count || lineCfg.checkboxMonths);
        const start = parseDate(line.startDate) || new Date();
        const missed = Object.values(line.months || {}).filter((v) => v === false).length;
        const taken = Object.values(line.months || {}).filter((v) => v === true).length;
        const highlightRestart = missed > lineCfg.restartMissed;
        const isLatest = lineIdx === displayLines.length - 1;

        return (
          <div
            key={line.id}
            className={`rounded-lg border p-4 ${isLatest ? "border-primary/40 bg-white" : "border-border bg-muted/20"}`}
            data-testid={`mdt-adherence-line-${lineIdx}`}
          >
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-semibold">
                  {isLatest ? "Current regimen" : `Previous regimen #${lineIdx + 1}`}
                  {line.regimen ? ` · ${line.regimen}` : ""}
                  {line.restartedFrom ? " · restarted" : ""}
                </p>
                <Field label="Regimen start date">
                  <Input
                    type="date"
                    className="h-11 max-w-xs bg-white text-base"
                    data-testid={`mdt-start-${lineIdx}`}
                    value={line.startDate || ""}
                    onChange={(e) => updateLine(line.id, { startDate: e.target.value })}
                    disabled={readOnly || !isLatest}
                    readOnly={readOnly}
                  />
                </Field>
                <p className="text-xs text-muted-foreground">
                  Start {fmtDate(line.startDate) || "—"} · {taken} taken · {missed} not taken
                </p>
              </div>
              {isLatest && !readOnly && (
                <Button
                  type="button"
                  variant={highlightRestart ? "default" : "outline"}
                  className={`h-11 ${highlightRestart ? "ring-2 ring-amber-400 ring-offset-2" : ""}`}
                  data-testid="adherence-restart"
                  onClick={() => restart(line)}
                >
                  Restart{highlightRestart ? " (recommended)" : ""}
                </Button>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: count }, (_, i) => {
                const d = new Date(start);
                d.setMonth(d.getMonth() + i);
                const monthName = `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
                const st = line.months?.[i];
                return (
                  <button
                    key={i}
                    type="button"
                    data-testid={`adherence-${lineIdx}-${i}`}
                    onClick={readOnly ? undefined : () => setMonth(line.id, i, cycleAdherence(st))}
                    disabled={readOnly}
                    className={`flex min-h-12 items-center gap-2 rounded-md border px-3 text-left text-sm font-semibold ${
                      st === true
                        ? "border-green-500 bg-green-50 text-green-800"
                        : st === false
                          ? "border-red-400 bg-red-50 text-red-800"
                          : "border-border bg-white"
                    } ${readOnly ? "cursor-default disabled:opacity-100" : ""}`}
                  >
                    {st === true ? <Check className="h-4 w-4" /> : <span className="h-4 w-4 rounded border border-input" />}
                    <span className="flex-1">
                      {monthName}
                      <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                        Month {i + 1}
                        {i < lineCfg.courseMonths ? "" : " · extension"}
                      </span>
                    </span>
                    <span className="text-[10px]">{st === true ? "Taken" : st === false ? "Not taken" : ""}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const AdherenceGrid = ({ spec, value = {}, onChange, startDate, onRestart, diagnosis, readOnly = false }) => {
  const cfg = spec.adherence;
  if (!cfg) return null;

  if (spec.id === "leprosy" || cfg.mdt) {
    return (
      <LeprosyMdtAdherence
        value={value}
        onChange={onChange}
        startDate={startDate}
        diagnosis={diagnosis}
        readOnly={readOnly}
      />
    );
  }

  const start = startDate ? parseDate(startDate) || new Date() : new Date();
  const cells = Array.from({ length: Number(value.count || cfg.count) }, (_, i) => {
    const d = new Date(start);
    cfg.unit === "week" ? d.setDate(d.getDate() + i * 7) : d.setMonth(d.getMonth() + i);
    return { i, label: `${cfg.unit === "week" ? "Week" : "Month"} ${i + 1} · ${fmtDate(d)}` };
  });
  const missed = cells.filter((c) => value[c.i] === false).length;

  return (
    <Field label={cfg.label} hint={`Start ${fmtDate(startDate) || "today"} · ${missed} marked not taken`}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {cells.map((c) => {
          const st = value[c.i];
          return (
            <button key={c.i} type="button" data-testid={`adherence-${c.i}`}
              onClick={readOnly ? undefined : () => onChange({ ...value, [c.i]: cycleAdherence(st) })}
              disabled={readOnly}
              className={`flex min-h-12 items-center gap-2 rounded-md border px-3 text-left text-sm font-semibold ${
                st === true ? "border-green-500 bg-green-50 text-green-800" : st === false ? "border-red-400 bg-red-50 text-red-800" : "border-border bg-white"} ${readOnly ? "cursor-default disabled:opacity-100" : ""}`}>
              {st === true ? <Check className="h-4 w-4" /> : <span className="h-4 w-4 rounded border border-input" />}
              {c.label}
              <span className="ml-auto text-[10px]">{st === true ? "Taken" : st === false ? "Not taken" : ""}</span>
            </button>
          );
        })}
      </div>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-11" data-testid="adherence-extend" onClick={() => onChange({ ...value, count: Number(value.count || cfg.count) + (cfg.unit === "week" ? 4 : 3) })}>
            Extend schedule
          </Button>
          {cfg.restart && (
            <Button type="button" variant={missed > 3 ? "default" : "outline"} className="h-11" data-testid="adherence-restart"
              onClick={() => { onRestart?.(); toast.success("New adherence line started — previous line retained"); }}>
              Restart regimen{missed > 3 ? " (recommended)" : ""}
            </Button>
          )}
        </div>
      )}
    </Field>
  );
};
