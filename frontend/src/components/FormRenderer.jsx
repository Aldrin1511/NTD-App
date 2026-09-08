import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, TextField, AreaField, SelectField, ChoiceRow, CheckGrid } from "@/components/Fields";
import { RELATIONSHIPS, CONTACT_STATUS, CONSENT, AGE_SEX_GROUPS, fmtDate } from "@/mock/specs";
import { Plus, Trash2, Check } from "lucide-react";
import BodySilhouette from "@/components/BodySilhouette";
import { toast } from "sonner";

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const FormRenderer = ({ fields, data, onChange, prefix = "f" }) => {
  const set = (k) => (v) => onChange({ ...data, [k]: v });
  const visible = fields.filter((f) => !f.when || data[f.when[0]] === f.when[1]);

  return (
    <div className="space-y-5">
      {visible.map((f) => {
        const id = `${prefix}-${slug(f.k)}`;
        const v = data[f.k];
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
        if (f.type === "groupCount") return <GroupCount key={f.k} label={f.label} note={f.note} value={v || {}} onChange={set(f.k)} id={id} />;
        if (f.type === "contactTable") return <ContactTable key={f.k} label={f.label} value={v || []} onChange={set(f.k)} id={id} prophylaxis={f.prophylaxis} />;
        return null;
      })}
    </div>
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

const GroupCount = ({ label, note, value, onChange, id }) => {
  const total = AGE_SEX_GROUPS.reduce((a, g) => a + (Number(value[g]) || 0), 0);
  return (
    <Field label={`${label} — total ${total}`} hint={note}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {AGE_SEX_GROUPS.map((g) => (
          <div key={g} className="rounded-md border border-border p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{g}</p>
            <Input type="number" className="mt-1 h-11 bg-white" data-testid={`${id}-${slug(g)}`} value={value[g] ?? ""} onChange={(e) => onChange({ ...value, [g]: e.target.value })} />
          </div>
        ))}
      </div>
    </Field>
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

export const DiseaseBodyChart = ({ spec, marks, onChange, sex = "Male" }) => {
  const [view, setView] = useState(spec.bodyChart.views[0]);
  const [bodySex, setBodySex] = useState(sex === "Female" ? "Female" : "Male");
  const [code, setCode] = useState(spec.bodyChart.codes[0][0]);
  const per = spec.bodyChart.perLesion;
  const views = spec.bodyChart.views.length > 1 ? spec.bodyChart.views : ["front", "back"];

  const place = (label) => {
    const key = `${view}:${label}`;
    if (marks[key]?.code === code) { const n = { ...marks }; delete n[key]; return onChange(n); }
    onChange({ ...marks, [key]: { region: label, view, code, label: spec.bodyChart.codes.find((c) => c[0] === code)?.[1] } });
  };

  const entries = Object.entries(marks);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {views.map((v) => (
          <button key={v} type="button" data-testid={`body-view-${v}`} onClick={() => setView(v)}
            className={`h-11 rounded-md border px-4 text-sm font-semibold capitalize ${view === v ? "border-primary bg-primary text-white" : "border-border bg-white"}`}>{v} view</button>
        ))}
        <div className="ml-auto flex gap-2">
          {["Male", "Female"].map((sx) => (
            <button key={sx} type="button" data-testid={`body-sex-${sx.toLowerCase()}`} onClick={() => setBodySex(sx)}
              className={`h-11 rounded-md border px-4 text-sm font-semibold ${bodySex === sx ? "border-primary bg-secondary text-primary" : "border-border bg-white text-muted-foreground"}`}>{sx}</button>
          ))}
        </div>
      </div>

      <Field label="1. Choose the finding, 2. click the body part">
        <div className="flex flex-wrap gap-2">
          {spec.bodyChart.codes.map(([c, lbl]) => (
            <button key={c} type="button" data-testid={`lesion-code-${c}`} onClick={() => setCode(c)}
              className={`h-11 rounded-md border px-3 text-sm font-semibold ${code === c ? "border-primary bg-primary text-white" : "border-border bg-white"}`}>
              <b>{c}</b> — {lbl}
            </button>
          ))}
        </div>
      </Field>

      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <BodySilhouette sex={bodySex} view={view} marks={marks} onPlace={place} activeCode={code} />
        <p className="mt-1 text-center text-xs text-muted-foreground">Hover a body part to highlight it · click to tag <b>{code}</b> · click again to clear</p>
      </div>

      <Field label={`Recorded findings (${entries.length})`}>
        {entries.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No findings marked yet.</p>
        ) : (
          <ul className="space-y-2" data-testid="lesion-list">
            {entries.map(([k, m]) => (
              <li key={k} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-white p-3 text-sm">
                <span className="font-semibold">{m.region}</span>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{m.view}</span>
                <span className="rounded bg-secondary px-2 py-0.5 text-xs font-bold text-primary">{m.code} · {m.label}</span>
                {per && per.options.map((o) => (
                  <button key={o} type="button" data-testid={`per-${slug(k)}-${slug(o)}`} onClick={() => onChange({ ...marks, [k]: { ...m, extra: o } })}
                    className={`h-9 rounded-md border px-2 text-xs font-semibold ${m.extra === o ? "border-primary bg-primary text-white" : "border-border bg-white"}`}>{o}</button>
                ))}
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

export const AdherenceGrid = ({ spec, value = {}, onChange, startDate, onRestart }) => {
  const cfg = spec.adherence;
  const start = startDate ? new Date(startDate) : new Date();
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
              onClick={() => onChange({ ...value, [c.i]: st === true ? false : st === false ? undefined : true })}
              className={`flex min-h-12 items-center gap-2 rounded-md border px-3 text-left text-sm font-semibold ${
                st === true ? "border-green-500 bg-green-50 text-green-800" : st === false ? "border-red-400 bg-red-50 text-red-800" : "border-border bg-white"}`}>
              {st === true ? <Check className="h-4 w-4" /> : <span className="h-4 w-4 rounded border border-input" />}
              {c.label}
              <span className="ml-auto text-[10px] uppercase">{st === true ? "taken" : st === false ? "not taken" : ""}</span>
            </button>
          );
        })}
      </div>
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
    </Field>
  );
};
