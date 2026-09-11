import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChoiceRow, CheckGrid, SelectField } from "@/components/Fields";
import { Trash2 } from "lucide-react";

const FRONT = [
  { id: "head", label: "Head", d: "M78 8h44c8 0 14 8 14 18 0 8-3 14-8 18H72c-5-4-8-10-8-18 0-10 6-18 14-18z" },
  { id: "face", label: "Face", d: "M82 36h36c4 0 8 4 8 10v14c0 8-8 14-18 14h-16c-10 0-18-6-18-14V46c0-6 4-10 8-10z" },
  { id: "ear-r", label: "Right ear", d: "M68 34h10v22H68c-4 0-6-4-6-11s2-11 6-11z" },
  { id: "ear-l", label: "Left ear", d: "M122 34h10c4 0 6 4 6 11s-2 11-6 11h-10z" },
  { id: "eye-r", label: "Right eye", d: "M86 46h12v8H86z" },
  { id: "eye-l", label: "Left eye", d: "M102 46h12v8h-12z" },
  { id: "neck", label: "Neck", d: "M88 74h24v16H88z" },
  { id: "chest", label: "Chest", d: "M68 90h64v46H68z" },
  { id: "abdomen", label: "Abdomen", d: "M72 136h56v42H72z" },
  { id: "arm-r", label: "Right arm", d: "M42 92h24v70H42z" },
  { id: "arm-l", label: "Left arm", d: "M134 92h24v70h-24z" },
  { id: "hand-r", label: "Right hand", d: "M40 162h26v18H40z" },
  { id: "hand-l", label: "Left hand", d: "M134 162h26v18h-26z" },
  { id: "palm-r", label: "Right palm", d: "M42 180h22v14H42z" },
  { id: "palm-l", label: "Left palm", d: "M136 180h22v14h-22z" },
  { id: "finger-r", label: "Right fingers", d: "M40 194h26v14H40z" },
  { id: "finger-l", label: "Left fingers", d: "M134 194h26v14h-26z" },
  { id: "groin", label: "Groin/Genital", d: "M80 178h40v28H80z" },
  { id: "thigh-r", label: "Right thigh", d: "M72 206h24v52H72z" },
  { id: "thigh-l", label: "Left thigh", d: "M104 206h24v52h-24z" },
  { id: "leg-r", label: "Right leg", d: "M74 258h22v54H74z" },
  { id: "leg-l", label: "Left leg", d: "M104 258h22v54h-22z" },
  { id: "foot-r", label: "Right foot", d: "M70 312h28v18H70z" },
  { id: "foot-l", label: "Left foot", d: "M102 312h28v18h-28z" },
  { id: "toe-r", label: "Right toes", d: "M68 330h30v14H68z" },
  { id: "toe-l", label: "Left toes", d: "M102 330h30v14h-30z" },
];

const BACK = [
  { id: "scalp", label: "Scalp", d: "M78 8h44c8 0 14 8 14 20 0 12-8 22-22 22H86c-14 0-22-10-22-22 0-12 6-20 14-20z" },
  { id: "neck-b", label: "Neck", d: "M88 50h24v16H88z" },
  { id: "upper-back", label: "Upper back", d: "M68 66h64v50H68z" },
  { id: "lower-back", label: "Lower back", d: "M72 116h56v44H72z" },
  { id: "buttocks", label: "Buttocks", d: "M74 160h52v34H74z" },
  { id: "post-arm-r", label: "Right posterior arm", d: "M42 70h24v90H42z" },
  { id: "post-arm-l", label: "Left posterior arm", d: "M134 70h24v90h-24z" },
  { id: "post-leg-r", label: "Right posterior leg", d: "M72 194h24v110H72z" },
  { id: "post-leg-l", label: "Left posterior leg", d: "M104 194h24v110h-24z" },
  { id: "foot-b-r", label: "Right foot", d: "M70 304h28v28H70z" },
  { id: "foot-b-l", label: "Left foot", d: "M102 304h28v28h-28z" },
];

const LESION_TYPES = ["Papule", "Vesicle", "Nodule", "Burrow", "Excoriation", "Crust", "Scale", "Erosion", "Ulcer", "Pustule", "Other"];
const EVIDENCE = ["Visible burrow", "Typical lesion", "Scratch marks", "Crusting", "Secondary infection", "Other"];

export default function BodyChart({ marks, onChange }) {
  const [view, setView] = useState("front");
  const [active, setActive] = useState(null);
  const [draft, setDraft] = useState({ type: "", severity: "", number: "", evidence: [] });
  const regions = view === "front" ? FRONT : BACK;

  const openRegion = (r) => {
    const existing = marks[r.id];
    setDraft(existing || { type: "", severity: "", number: "", evidence: [] });
    setActive(r);
  };

  const save = () => {
    onChange({ ...marks, [active.id]: { ...draft, label: active.label, view } });
    setActive(null);
  };

  const remove = (id) => {
    const next = { ...marks };
    delete next[id];
    onChange(next);
  };

  const list = Object.entries(marks);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
      <div className="rounded-lg border border-border bg-white p-4">
        <div className="mb-4 grid grid-cols-2 gap-2">
          {["front", "back"].map((v) => (
            <button
              key={v}
              type="button"
              data-testid={`body-view-${v}`}
              onClick={() => setView(v)}
              className={`h-11 rounded-md border text-sm font-semibold capitalize ${
                view === v ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-muted"
              }`}
            >
              {v} view
            </button>
          ))}
        </div>
        <svg viewBox="0 0 200 360" className="mx-auto h-[420px] w-full max-w-[280px]">
          {regions.map((r) => (
            <g key={r.id}>
              <path
                d={r.d}
                data-testid={`body-region-${r.id}`}
                className={`body-region ${marks[r.id] ? "marked" : ""}`}
                onClick={() => openRegion(r)}
              />
            </g>
          ))}
        </svg>
        <p className="mt-2 text-center text-xs text-muted-foreground">Tap a body region to record lesions</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-head text-lg font-semibold">Recorded lesions ({list.length})</h3>
        </div>
        {list.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">
            No lesions marked yet. Tap the body map to begin.
          </div>
        ) : (
          <ul className="space-y-2" data-testid="lesion-list">
            {list.map(([id, m]) => (
              <li key={id} className="flex items-start gap-3 rounded-md border border-border bg-white p-3">
                <div className="flex-1">
                  <p className="font-semibold">
                    {m.label} <span className="text-xs font-normal uppercase tracking-wider text-muted-foreground">({m.view})</span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {[m.type, m.severity, m.number].filter(Boolean).join(" · ") || "Details not set"}
                  </p>
                  {m.evidence?.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">Evidence: {m.evidence.join(", ")}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-red-600"
                  data-testid={`remove-lesion-${id}`}
                  onClick={() => remove(id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg" data-testid="lesion-dialog">
          <DialogHeader>
            <DialogTitle className="font-head text-xl">{active?.label} — lesion detail</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <SelectField
              label="Lesion type"
              value={draft.type}
              onChange={(v) => setDraft({ ...draft, type: v })}
              options={LESION_TYPES}
              testid="lesion-type"
            />
            <ChoiceRow
              label="Severity"
              options={["Mild", "Moderate", "Severe"]}
              value={draft.severity}
              onChange={(v) => setDraft({ ...draft, severity: v })}
              testid="lesion-severity"
            />
            <ChoiceRow
              label="Number"
              options={["Few", "Multiple", "Numerous", "Diffuse"]}
              value={draft.number}
              onChange={(v) => setDraft({ ...draft, number: v })}
              testid="lesion-number"
            />
            <CheckGrid
              label="Evidence"
              options={EVIDENCE}
              value={draft.evidence}
              onChange={(v) => setDraft({ ...draft, evidence: v })}
              testid="lesion-evidence"
              cols="sm:grid-cols-2"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-12" onClick={() => setActive(null)} data-testid="lesion-cancel">
              Cancel
            </Button>
            <Button className="h-12" onClick={save} data-testid="lesion-save">
              Save lesion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
