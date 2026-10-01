import { TextField } from "@/components/Fields";
import { ChoiceChips } from "@/components/EntryKit";
import { SERVICE_CHILD_FIELDS } from "@/mock/familyPlanning";

/**
 * Child detail fields for a Family Planning service (Apex FAPL popup fields).
 * Used by Family Planning encounter modal and ANC / Well Baby delivery section.
 */
export default function FamilyPlanningServiceDetails({
  service,
  value = {},
  onChange,
  testid = "fp-service-details",
}) {
  const fields = SERVICE_CHILD_FIELDS[service] || [];
  if (!service || service === "None" || service === "Planned" || !fields.length) return null;

  const set = (patch) => onChange?.({ ...(value || {}), ...patch });

  const toggleReason = (reason) => {
    const cur = Array.isArray(value?.removalReason) ? value.removalReason : [];
    set({
      removalReason: cur.includes(reason) ? cur.filter((x) => x !== reason) : [...cur, reason],
    });
  };

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3" data-testid={testid}>
      <p className="text-sm font-semibold text-primary">Family planning details · {service}</p>
      {fields.map((f) => {
        if (f.inputType === "radios") {
          return (
            <ChoiceChips
              key={f.key}
              label={f.label}
              options={f.options || []}
              value={value?.[f.key] || ""}
              onChange={(v) => set({ [f.key]: v })}
              testid={`${testid}-${f.key}`}
            />
          );
        }
        if (f.inputType === "checkboxs") {
          return (
            <div key={f.key}>
              <p className="mb-2 text-sm font-semibold">{f.label}</p>
              <div className="flex flex-wrap gap-3">
                {(f.options || []).map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={(value?.removalReason || []).includes(opt)}
                      onChange={() => toggleReason(opt)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          );
        }
        if (f.inputType === "datePicker") {
          return (
            <TextField
              key={f.key}
              label={f.label}
              type="date"
              allowEmpty
              testid={`${testid}-${f.key}`}
              value={value?.[f.key] || ""}
              onChange={(e) => set({ [f.key]: e.target.value })}
            />
          );
        }
        return (
          <TextField
            key={f.key}
            label={f.label}
            testid={`${testid}-${f.key}`}
            value={value?.[f.key] || ""}
            onChange={(e) => set({ [f.key]: e.target.value })}
          />
        );
      })}
    </div>
  );
}
