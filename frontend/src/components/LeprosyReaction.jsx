import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { TextField, ChoiceRow, AreaField } from "@/components/Fields";
import { localISODate } from "@/mock/specs";
import { Plus, Stethoscope } from "lucide-react";

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

export const emptyReaction = () => ({
  id: `lr-${Date.now()}`,
  onsetDate: localISODate(),
  onsetDays: "",
  onsetMonths: "",
  onsetYears: "",
  diagnosisDate: localISODate(),
  occurred: "",
  reactionType: "",
  selections: emptySelections(),
  notes: "",
  typeManual: false,
});

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

const findingLabels = (selections) => {
  const labels = [];
  REACTION_GRID.forEach((row) => {
    REACTION_COLS.forEach(({ key }) => {
      (selections?.[row.category]?.[key] || []).forEach((label) => {
        if (label) labels.push(label);
      });
    });
  });
  return labels;
};

export const isReactionFilled = (r) => {
  if (!r) return false;
  if (String(r.occurred || "").trim()) return true;
  if (String(r.reactionType || "").trim()) return true;
  if (String(r.notes || "").trim()) return true;
  return findingLabels(r.selections).length > 0;
};

function ReactionForm({ draft, onPatch, onStartExam, id, heading }) {
  const setField = (k) => (v) => onPatch({ [k]: v });

  const toggleFinding = (category, colKey, label) => {
    const selections = { ...emptySelections(), ...(draft.selections || {}) };
    const cat = selections[category] || { type1: [], type2: [], drug: [] };
    const nextSel = {
      ...selections,
      [category]: {
        ...cat,
        [colKey]: toggleInList(cat[colKey], label),
      },
    };
    onPatch({
      selections: nextSel,
      reactionType: draft.typeManual ? draft.reactionType : inferReactionType(nextSel),
    });
  };

  return (
    <div className="space-y-6 rounded-lg border border-primary/25 bg-white p-4" data-testid={`${id}-form`}>
      <p className="font-head text-base font-semibold tracking-tight">{heading}</p>
      <div className="space-y-6">
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

        <ChoiceRow
          label="Reaction type (auto from findings — override if needed)"
          options={REACTION_TYPES}
          value={draft.reactionType}
          onChange={(v) => onPatch({ reactionType: v, typeManual: true })}
          testid={`${id}-type`}
        />

        <AreaField
          label="Notes"
          rows={3}
          testid={`${id}-notes`}
          value={draft.notes}
          onChange={(e) => setField("notes")(e.target.value)}
        />

        <Button
          type="button"
          variant="outline"
          className="h-12 w-full sm:w-auto"
          data-testid={`${id}-start-exam`}
          onClick={() => onStartExam?.("Upon Reaction")}
        >
          <Stethoscope className="mr-2 h-4 w-4" /> Start Leprosy Assessment Upon Reaction
        </Button>
      </div>
    </div>
  );
}

export default function LeprosyReaction({ value = [], onChange, onStartExam, followUp = false, id = "lep-reaction" }) {
  const rows = Array.isArray(value) ? value : [];
  const seedRef = useRef(null);
  if (!seedRef.current) seedRef.current = emptyReaction();

  const forms = followUp ? rows : (rows.length ? rows : [seedRef.current]);

  const patchAt = (i) => (partial) => {
    const base = rows.length ? rows : [seedRef.current];
    onChange(base.map((r, j) => (j === i ? { ...r, ...partial } : r)));
  };

  const add = () => onChange([...rows, emptyReaction()]);

  return (
    <div className="space-y-4" data-testid={id}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-head text-lg font-semibold tracking-tight">Leprosy Reaction</p>
          <p className="text-xs text-muted-foreground">
            {followUp
              ? `${rows.filter(isReactionFilled).length} assessment${rows.filter(isReactionFilled).length === 1 ? "" : "s"} this visit`
              : "Record findings for this reaction"}
          </p>
        </div>
        {followUp && (
          <Button type="button" className="h-11" data-testid={`${id}-add`} onClick={add}>
            <Plus className="mr-2 h-4 w-4" /> Add
          </Button>
        )}
      </div>

      {forms.map((row, i) => (
        <ReactionForm
          key={row.id || i}
          draft={{ ...emptyReaction(), ...row, selections: { ...emptySelections(), ...(row.selections || {}) } }}
          onPatch={patchAt(i)}
          onStartExam={onStartExam}
          id={`${id}-${i}`}
          heading={followUp && rows.length > 1 ? `Reaction Assessment ${i + 1}` : "Reaction Assessment"}
        />
      ))}

      {followUp && rows.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No reaction assessments this visit. Use Add to record one.
        </p>
      )}
    </div>
  );
}
