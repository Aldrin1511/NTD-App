import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check } from "lucide-react";

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const Field = ({ label, hint, children, className = "" }) => (
  <div className={`min-w-0 space-y-2 ${className}`}>
    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
    {children}
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

export const TextField = ({ label, hint, testid, className, ...rest }) => (
  <Field label={label} hint={hint} className={className}>
    <Input data-testid={testid} className="h-12 w-full min-w-0 bg-white text-base" {...rest} />
  </Field>
);

export const AreaField = ({ label, testid, rows = 5, ...rest }) => (
  <Field label={label}>
    <Textarea data-testid={testid} rows={rows} className="bg-white text-base" {...rest} />
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
      <p className="font-head text-sm font-bold uppercase tracking-wide">{title}</p>
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
