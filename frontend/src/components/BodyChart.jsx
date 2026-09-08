import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChoiceRow, CheckGrid, SelectField } from "@/components/Fields";
import { Trash2 } from "lucide-react";

const FRONT = [
  { id: "head", label: "Head", d: "M100 8 a20 20 0 0 1 0 44 a20 20 0 0 1 0 -44" },
  { id: "face", label: "Face", d: "M88 22 h24 v22 h-24 z" },
  { id: "neck", label: "Neck", d: "M90 52 h20 v12 h-20 z" },
  { id: "chest", label: "Chest", d: "M72 64 h56 v40 h-56 z" },
  { id: "abdomen", label: "Abdomen", d: "M74 104 h52 v42 h-52 z" },
  { id: "arm-r", label: "R arm", d: "M46 68 h24 v78 h-24 z" },
  { id: "arm-l", label: "L arm", d: "M130 68 h24 v78 h-24 z" },
  { id: "hand-r", label: "R hand", d: "M44 146 h28 v26 h-28 z" },
  { id: "hand-l", label: "L hand", d: "M128 146 h28 v26 h-28 z" },
  { id: "groin", label: "Groin", d: "M82 146 h36 v22 h-36 z" },
  { id: "thigh-r", label: "R thigh", d: "M76 168 h20 v52 h-20 z" },
  { id: "thigh-l", label: "L thigh", d: "M104 168 h20 v52 h-20 z" },
  { id: "leg-r", label: "R leg", d: "M78 220 h18 v52 h-18 z" },
  { id: "leg-l", label: "L leg", d: "M104 220 h18 v52 h-18 z" },
  { id: "foot-r", label: "R foot", d: "M74 272 h24 v20 h-24 z" },
  { id: "foot-l", label: "L foot", d: "M102 272 h24 v20 h-24 z" },
];

const BACK = [
  { id: "scalp", label: "Scalp", d: "M100 8 a20 20 0 0 1 0 44 a20 20 0 0 1 0 -44" },
  { id: "neck-b", label: "Neck", d: "M90 52 h20 v12 h-20 z" },
  { id: "upper-back", label: "Upper back", d: "M72 64 h56 v42 h-56 z" },
  { id: "lower-back", label: "Lower back", d: "M74 106 h52 v40 h-52 z" },
  { id: "buttocks", label: "Buttocks", d: "M76 146 h48 v26 h-48 z" },
  { id: "arm-post-r", label: "Post. R arm", d: "M46 68 h24 v78 h-24 z" },
  { id: "arm-post-l", label: "Post. L arm", d: "M130 68 h24 v78 h-24 z" },
  { id: "palm-r", label: "R palm", d: "M44 146 h28 v26 h-28 z" },
  { id: "palm-l", label: "L palm", d: "M128 146 h28 v26 h-28 z" },
  { id: "leg-post-r", label: "Post. R leg", d: "M76 172 h20 v100 h-20 z" },
  { id: "leg-post-l", label: "Post. L leg", d: "M104 172 h20 v100 h-20 z" },
  { id: "sole-r", label: "R sole", d: "M74 272 h24 v20 h-24 z" },
  { id: "sole-l", label: "L sole", d: "M102 272 h24 v20 h-24 z" },
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
        <svg viewBox="0 0 200 300" className="mx-auto h-[420px] w-full max-w-[280px]">
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
