import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TextField, ChoiceRow, AreaField } from "@/components/Fields";
import { fmtDate, localISODate } from "@/mock/specs";
import { Pencil, Plus, Trash2, Eye } from "lucide-react";
import {
  SensoryTestingChart,
  VmtChart,
  VisionAcuityChart,
  emptySensory,
  emptyVmt,
  emptyVision,
} from "@/components/LeprosyReactionCharts";

export const REACTION_TYPES = [
  "Reversal reaction (Type 1 reaction)",
  "ENL (Type 2 reaction)",
  "Drug reaction",
];

const OCCURRED = ["Before MDT", "During MDT", "After MDT"];

export const REACTION_COLS = [
  { key: "type1", label: "Type 1 - Leprosy Reaction" },
  { key: "type2", label: "Type 2(ENL) - Leprosy Reaction" },
  { key: "drug", label: "Drug Reaction" },
];

/** Grid options with Apex priority scores (1=Type1 cue, 2=ENL, 3=Drug). */
export const REACTION_GRID = [
  {
    category: "Skin",
    type1: [
      { label: "Red patches", priority: 0 },
      { label: "Raised patches", priority: 0 },
      { label: "Tender skin patches", priority: 0 },
    ],
    type2: [
      { label: "Red patches", priority: 0 },
      { label: "Raised patches", priority: 0 },
      { label: "Tender skin patches", priority: 0 },
      { label: "Sub-cutaneous nodules (just under the skin)", priority: 2 },
    ],
    drug: [
      { label: "Diffused skin rashes - can be red, itching", priority: 3 },
    ],
  },
  {
    category: "Nerves",
    type1: [
      { label: "Painful", priority: 0 },
      { label: "Tender", priority: 0 },
      { label: "Enlarged nerves when palpated (felt)", priority: 0 },
      { label: "Red patches", priority: 1 },
      { label: "Raised patches on or around a nerve", priority: 1 },
    ],
    type2: [
      { label: "Painful", priority: 0 },
      { label: "Tender", priority: 0 },
      { label: "Enlarged nerves when palpated (felt)", priority: 0 },
    ],
    drug: [],
  },
  {
    category: "Voluntary Muscle Test (VMT)",
    type1: [
      { label: "Recent change in VMT (less than 6 months)", priority: 0 },
      { label: "Muscle weakness in eyes, hands and feet", priority: 0 },
    ],
    type2: [
      { label: "Recent change in VMT (less than 6 months)", priority: 0 },
      { label: "Muscle weakness in eyes, hands and feet", priority: 0 },
    ],
    drug: [],
  },
  {
    category: "Sensory Test (ST)",
    type1: [
      { label: "Recent change in ST (less than 6 months)", priority: 0 },
      { label: "Change in sensation in one or more points, in any one hand or foot", priority: 0 },
    ],
    type2: [
      { label: "Recent change in ST (less than 6 months)", priority: 0 },
      { label: "Change in sensation in one or more points, in any one hand or foot", priority: 0 },
    ],
    drug: [],
  },
  {
    category: "Eyes",
    type1: [
      { label: "Sudden inability to close eyes (lagophthalmus)", priority: 1 },
      { label: "Sudden loss of corneal sensation (loss of blink)", priority: 1 },
    ],
    type2: [
      { label: "Painful eyes with redness in white of eye", priority: 2 },
      { label: "Excessive tearing", priority: 2 },
      { label: "Eye avoidance of light", priority: 2 },
      { label: "Diminished vision", priority: 2 },
    ],
    drug: [],
  },
  {
    category: "General Body Condition",
    type1: [
      { label: "Fever and feeling unwell occurs in acute phases only", priority: 0 },
    ],
    type2: [
      { label: "Fever and feeling unwell is common and prolonged", priority: 0 },
    ],
    drug: [
      { label: "Fever or chills", priority: 3 },
      { label: "General body weakness or feeling unwell", priority: 3 },
      { label: "Headaches", priority: 3 },
      { label: "Dizziness", priority: 3 },
      { label: "Fatigue and unusual weakness", priority: 3 },
    ],
  },
  {
    category: "Internal Body Condition",
    type1: [
      { label: "Joint pain due to enlarged nerves", priority: 1 },
    ],
    type2: [
      { label: "Painful", priority: 2 },
      { label: "Swollen joints", priority: 2 },
      { label: "Hands", priority: 2 },
      { label: "Feet (Dactylitis)", priority: 2 },
      { label: "Testicular swelling (Orchitis)", priority: 2 },
      { label: "Blood in urine (Renal involvement)", priority: 2 },
    ],
    drug: [
      { label: "Joint", priority: 3 },
      { label: "Muscle pains", priority: 3 },
      { label: "Mucus membrane involvement - sore throat, mouth sores, sore nose", priority: 3 },
      { label: "Anaemia with shortness of breath", priority: 3 },
      { label: "Severe abdominal pain", priority: 3 },
      { label: "Jaundice (Yellow skin or eyes), dark yellow urine", priority: 3 },
    ],
  },
];

const priorityClass = (p) => {
  if (p === 1) return "text-sky-700";
  if (p === 2) return "text-orange-600";
  if (p === 3) return "text-emerald-700";
  return "text-foreground";
};

const emptySelections = () =>
  Object.fromEntries(
    REACTION_GRID.map((row) => [
      row.category,
      { type1: [], type2: [], drug: [] },
    ]),
  );

const emptyReaction = () => ({
  id: `lr-${Date.now()}`,
  onsetDate: localISODate(),
  onsetDays: "",
  onsetMonths: "",
  onsetYears: "",
  diagnosisDate: localISODate(),
  occurred: "",
  reactionType: "",
  selections: emptySelections(),
  sensory: emptySensory(),
  vmt: emptyVmt(),
  vision: emptyVision(),
  notes: "",
  typeManual: false,
});

const countChartMarks = (chart) => Object.keys(chart?.points || {}).length;

const toggleInList = (list, item) =>
  (list || []).includes(item) ? list.filter((x) => x !== item) : [...(list || []), item];

const inferReactionType = (selections) => {
  const scores = new Set();
  REACTION_GRID.forEach((row) => {
    REACTION_COLS.forEach(({ key }) => {
      (selections?.[row.category]?.[key] || []).forEach((label) => {
        const opt = (row[key] || []).find((o) => o.label === label);
        if (opt && opt.priority > 0) scores.add(opt.priority);
        else if (opt) scores.add(0);
      });
    });
  });
  const meaningful = [...scores].filter((s) => s > 0);
  if (meaningful.length === 1) {
    if (meaningful[0] === 1) return REACTION_TYPES[0];
    if (meaningful[0] === 2) return REACTION_TYPES[1];
    if (meaningful[0] === 3) return REACTION_TYPES[2];
  }
  return "";
};

const countFindings = (selections) =>
  REACTION_GRID.reduce(
    (n, row) => n + REACTION_COLS.reduce((a, { key }) => a + (selections?.[row.category]?.[key] || []).length, 0),
    0,
  );

export default function LeprosyReaction({ value = [], onChange, id = "lep-reaction" }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("add");
  const [draft, setDraft] = useState(emptyReaction());
  const [editIndex, setEditIndex] = useState(-1);

  const rows = Array.isArray(value) ? value : [];
  const readOnly = mode === "view";

  const openAdd = () => {
    setMode("add");
    setEditIndex(-1);
    setDraft(emptyReaction());
    setOpen(true);
  };

  const openRow = (i, nextMode) => {
    setMode(nextMode);
    setEditIndex(i);
    const row = rows[i] || {};
    setDraft({
      ...emptyReaction(),
      ...row,
      selections: { ...emptySelections(), ...(row.selections || {}) },
      sensory: { ...emptySensory(), ...(row.sensory || {}), points: { ...(row.sensory?.points || {}) } },
      vmt: { ...emptyVmt(), ...(row.vmt || {}), points: { ...(row.vmt?.points || {}) } },
      vision: { ...emptyVision(), ...(row.vision || {}), points: { ...(row.vision?.points || {}) } },
    });
    setOpen(true);
  };

  const remove = (i) => onChange(rows.filter((_, j) => j !== i));

  const setField = (k) => (v) => setDraft((s) => ({ ...s, [k]: v }));

  const toggleFinding = (category, colKey, label) => {
    if (readOnly) return;
    setDraft((s) => {
      const nextSel = {
        ...s.selections,
        [category]: {
          ...s.selections[category],
          [colKey]: toggleInList(s.selections[category]?.[colKey], label),
        },
      };
      const inferred = inferReactionType(nextSel);
      return {
        ...s,
        selections: nextSel,
        reactionType: s.typeManual ? s.reactionType : inferred,
      };
    });
  };

  const save = () => {
    const row = { ...draft, id: draft.id || `lr-${Date.now()}` };
    if (editIndex >= 0) onChange(rows.map((r, j) => (j === editIndex ? row : r)));
    else onChange([row, ...rows]);
    setOpen(false);
  };

  const title = useMemo(() => {
    if (mode === "view") return "View Reaction Assessment";
    if (mode === "edit") return "Edit Reaction Assessment";
    return "Reaction Assessment";
  }, [mode]);

  return (
    <div className="space-y-4" data-testid={id}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-head text-lg font-semibold tracking-tight">Leprosy Reaction</p>
          <p className="text-xs text-muted-foreground">
            {rows.length} assessment{rows.length === 1 ? "" : "s"} recorded
          </p>
        </div>
        <Button type="button" className="h-11" data-testid={`${id}-add`} onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" /> Add
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-sm" data-testid={`${id}-table`}>
          <thead className="bg-muted">
            <tr>
              {["Reaction type", "Occurred", "Diagnosis date", "Findings", "Charts", ""].map((h) => (
                <th key={h || "a"} className="p-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">No reaction assessments yet.</td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.id || i} className="border-t border-border align-top">
                  <td className="p-3 font-semibold">{r.reactionType || "—"}</td>
                  <td className="p-3">{r.occurred || "—"}</td>
                  <td className="p-3">{r.diagnosisDate ? fmtDate(r.diagnosisDate) : "—"}</td>
                  <td className="p-3 text-muted-foreground">{countFindings(r.selections)} finding(s)</td>
                  <td className="p-3 text-muted-foreground">
                    ST {countChartMarks(r.sensory)} · VMT {countChartMarks(r.vmt)} · VA {countChartMarks(r.vision)}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="ghost" className="h-9 px-2 text-primary" data-testid={`${id}-view-${i}`} onClick={() => openRow(i, "view")}>
                        <Eye className="mr-1 h-4 w-4" /> View
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-primary" data-testid={`${id}-edit-${i}`} onClick={() => openRow(i, "edit")}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-600" data-testid={`${id}-remove-${i}`} onClick={() => remove(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl" data-testid={`${id}-dialog`}>
          <DialogHeader>
            <DialogTitle className="font-head text-xl">{title}</DialogTitle>
          </DialogHeader>

          <div className={`space-y-6 ${readOnly ? "pointer-events-none opacity-90" : ""}`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <TextField
                  label="Reaction onset"
                  type="date"
                  testid={`${id}-onset-date`}
                  value={draft.onsetDate}
                  onChange={(e) => setField("onsetDate")(e.target.value)}
                />
                <div className="grid grid-cols-3 gap-2">
                  <TextField label="Days" type="number" testid={`${id}-onset-days`} value={draft.onsetDays} onChange={(e) => setField("onsetDays")(e.target.value)} />
                  <TextField label="Months" type="number" testid={`${id}-onset-months`} value={draft.onsetMonths} onChange={(e) => setField("onsetMonths")(e.target.value)} />
                  <TextField label="Years" type="number" testid={`${id}-onset-years`} value={draft.onsetYears} onChange={(e) => setField("onsetYears")(e.target.value)} />
                </div>
              </div>
              <TextField
                label="Date of diagnosis"
                type="date"
                testid={`${id}-dx-date`}
                value={draft.diagnosisDate}
                onChange={(e) => setField("diagnosisDate")(e.target.value)}
              />
            </div>

            <ChoiceRow
              label="Reaction Occurred"
              options={OCCURRED}
              value={draft.occurred}
              onChange={setField("occurred")}
              testid={`${id}-occurred`}
            />

            <ChoiceRow
              label="Reaction type (auto from findings — override if needed)"
              options={REACTION_TYPES}
              value={draft.reactionType}
              onChange={(v) => setDraft((s) => ({ ...s, reactionType: v, typeManual: true }))}
              testid={`${id}-type`}
            />

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[900px] text-sm" data-testid={`${id}-grid`}>
                <thead className="bg-muted">
                  <tr>
                    <th className="sticky left-0 z-10 bg-muted p-3 text-left text-xs font-semibold text-muted-foreground">Reaction</th>
                    {REACTION_COLS.map((c) => (
                      <th key={c.key} className="p-3 text-left text-xs font-semibold text-muted-foreground">{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {REACTION_GRID.map((row) => (
                    <tr key={row.category} className="border-t border-border align-top">
                      <td className="sticky left-0 z-10 bg-white p-3 font-semibold">{row.category}</td>
                      {REACTION_COLS.map((col) => (
                        <td key={col.key} className="p-3">
                          <div className="space-y-2">
                            {(row[col.key] || []).map((opt) => {
                              const on = (draft.selections?.[row.category]?.[col.key] || []).includes(opt.label);
                              return (
                                <label
                                  key={`${col.key}-${opt.label}`}
                                  className={`flex cursor-pointer items-start gap-2 text-sm ${priorityClass(opt.priority)}`}
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-1 h-4 w-4 accent-primary"
                                    checked={on}
                                    onChange={() => toggleFinding(row.category, col.key, opt.label)}
                                    data-testid={`${id}-${row.category}-${col.key}-${opt.label}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
                                  />
                                  <span className={on ? "font-semibold" : ""}>{opt.label}</span>
                                </label>
                              );
                            })}
                            {(row[col.key] || []).length === 0 && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <SensoryTestingChart
              id={`${id}-st`}
              value={draft.sensory}
              onChange={(sensory) => setDraft((s) => ({ ...s, sensory }))}
              readOnly={readOnly}
            />
            <VmtChart
              id={`${id}-vmt`}
              value={draft.vmt}
              onChange={(vmt) => setDraft((s) => ({ ...s, vmt }))}
              readOnly={readOnly}
            />
            <VisionAcuityChart
              id={`${id}-vision`}
              value={draft.vision}
              onChange={(vision) => setDraft((s) => ({ ...s, vision }))}
              readOnly={readOnly}
            />

            <AreaField
              label="Notes"
              rows={3}
              testid={`${id}-notes`}
              value={draft.notes}
              onChange={(e) => setField("notes")(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="h-12" onClick={() => setOpen(false)} data-testid={`${id}-cancel`}>
              {readOnly ? "Close" : "Cancel"}
            </Button>
            {!readOnly && (
              <Button type="button" className="h-12" onClick={save} data-testid={`${id}-save`}>
                Save
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
