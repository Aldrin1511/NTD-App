import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Check, Plus, Trash2 } from "lucide-react";

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "nor", "of", "on", "or", "the", "to", "via"]);
const UNIT_WORDS = new Set(["cm", "cms", "kg", "kgs", "mg", "ml", "g", "im", "imi"]);

/** Title-case short field labels (First Name, Date of Birth). Leaves questions/sentences unchanged. */
export const titleCaseLabel = (text) => {
  const s = String(text ?? "");
  if (!s || s.includes("?")) return s;
  if (s.trim().split(/\s+/).length > 8) return s;
  let seen = false;
  return s.replace(/[A-Za-z0-9]+/g, (word) => {
    const isFirst = !seen;
    seen = true;
    const lower = word.toLowerCase();
    if (UNIT_WORDS.has(lower)) return lower;
    if (word.length > 1 && word === word.toUpperCase()) return word;
    if (!isFirst && SMALL_WORDS.has(lower)) return lower;
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
};

/** Capitalize the first letter of each name part as the user types. */
export const capitalizeName = (value) =>
  String(value ?? "").replace(/(^|[\s'-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());

export const labelClass = "text-xs font-semibold text-muted-foreground";

export const Field = ({ label, hint, children, className = "" }) => (
  <div className={`min-w-0 space-y-2 ${className}`}>
    <Label className={labelClass}>{titleCaseLabel(label)}</Label>
    {children}
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

export const TextField = ({ label, hint, testid, className, placeholder, ...rest }) => (
  <Field label={label} hint={hint} className={className}>
    <Input data-testid={testid} className="h-12 w-full min-w-0 bg-white text-base" placeholder={placeholder ?? label} {...rest} />
  </Field>
);

export const AreaField = ({ label, testid, rows = 5, placeholder, ...rest }) => (
  <Field label={label}>
    <Textarea data-testid={testid} rows={rows} className="bg-white text-base" placeholder={placeholder ?? label} {...rest} />
  </Field>
);

export const SelectField = ({ label, value, onChange, options, placeholder = "Select…", testid, hint }) => (
  <Field label={label} hint={hint}>
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger className="h-12 w-full min-w-0 bg-white text-base" data-testid={testid}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o} className="text-base" data-testid={`${testid}-opt-${o}`}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </Field>
);

export const ChoiceRow = ({ label, options, value, onChange, testid, hint }) => (
  <Field label={label} hint={hint}>
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            type="button"
            data-testid={`${testid}-${slug(o)}`}
            onClick={() => onChange(active ? "" : o)}
            className={`h-12 rounded-md border px-4 text-sm font-semibold transition-colors ${
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-white text-foreground hover:bg-muted"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  </Field>
);

export const CheckGrid = ({ label, options, value = [], onChange, testid, cols = "sm:grid-cols-2 lg:grid-cols-3" }) => {
  const toggle = (o) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <Field label={label}>
      <div className={`grid gap-2 ${cols}`}>
        {options.map((o) => {
          const active = value.includes(o);
          return (
            <button
              key={o}
              type="button"
              data-testid={`${testid}-${slug(o)}`}
              onClick={() => toggle(o)}
              className={`flex min-h-12 items-center gap-3 rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors ${
                active ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-white hover:bg-muted"
              }`}
            >
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded border ${
                  active ? "border-primary bg-primary text-white" : "border-input bg-white"
                }`}
              >
                {active && <Check className="h-4 w-4" />}
              </span>
              {o}
            </button>
          );
        })}
      </div>
    </Field>
  );
};

export const AlertPanel = ({ level = "routine", title, children, testid }) => {
  const map = {
    urgent: "border-l-red-600 bg-red-50 text-red-900",
    review: "border-l-orange-500 bg-orange-50 text-orange-900",
    routine: "border-l-green-600 bg-green-50 text-green-900",
    info: "border-l-primary bg-secondary text-secondary-foreground",
  }[level];
  return (
    <div data-testid={testid} className={`rounded-md border border-border border-l-4 p-4 ${map}`}>
      <p className="font-head text-sm font-bold">{title}</p>
      {children && <div className="mt-1.5 text-sm">{children}</div>}
    </div>
  );
};

export const SectionCard = ({ title, desc, children, right }) => (
  <section className="min-w-0 rounded-lg border border-border bg-white">
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div>
        <h2 className="font-head text-xl font-semibold tracking-tight">{title}</h2>
        {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      </div>
      {right}
    </div>
    <div className="space-y-6 p-5">{children}</div>
  </section>
);

/** + / remove controls for a repeatable item (exam, lab result, drug course, note). */
export const ItemActions = ({ onAdd, onRemove, addTestid, removeTestid, canRemove = false }) => (
  <div className="flex shrink-0 items-center gap-1">
    {onAdd && (
      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-primary" data-testid={addTestid} onClick={onAdd} aria-label="Add">
        <Plus className="h-4 w-4" />
      </Button>
    )}
    {canRemove && onRemove && (
      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-600" data-testid={removeTestid} onClick={onRemove} aria-label="Remove">
        <Trash2 className="h-4 w-4" />
      </Button>
    )}
  </div>
);

export function withDrugCourse(medCourses, name, on) {
  const courses = { ...(medCourses || {}) };
  if (on && !courses[name]?.length) courses[name] = [{ id: `mc-${Date.now()}`, date: "" }];
  if (!on) delete courses[name];
  return courses;
}

export function DrugCourseBlock({ name, medCourses, onChange }) {
  return (
    <MedCourses
      courses={medCourses?.[name] || []}
      onChange={(rows) => onChange({ medCourses: { ...(medCourses || {}), [name]: rows } })}
      testid={`med-course-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
    />
  );
}

export const MedCourses = ({ courses = [], onChange, testid = "med-course" }) => {
  const rows = Array.isArray(courses) && courses.length ? courses : [{ id: "mc-0", date: "" }];
  const update = (i, date) => onChange(rows.map((r, j) => (j === i ? { ...r, date } : r)));
  const addAfter = (i) => {
    const next = [...rows];
    next.splice(i + 1, 0, { id: `mc-${Date.now()}`, date: "" });
    onChange(next);
  };
  const remove = (i) => {
    if (rows.length <= 1) return onChange([{ id: `mc-${Date.now()}`, date: "" }]);
    onChange(rows.filter((_, j) => j !== i));
  };
  return (
    <div className="space-y-2" data-testid={testid}>
      {rows.map((row, i) => (
        <div key={row.id || i} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <TextField
              label={rows.length > 1 ? `Date given (${i + 1})` : "Date given"}
              type="date"
              testid={`${testid}-date-${i}`}
              value={row.date || ""}
              onChange={(e) => update(i, e.target.value)}
            />
          </div>
          <div className="mb-1">
            <ItemActions
              onAdd={() => addAfter(i)}
              addTestid={`${testid}-add-${i}`}
              canRemove={rows.length > 1}
              onRemove={() => remove(i)}
              removeTestid={`${testid}-remove-${i}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
