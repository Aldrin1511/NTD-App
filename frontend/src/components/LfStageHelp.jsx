import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CircleHelp } from "lucide-react";

/** Simple progressive leg illustrations for LF staging help. */
const StageSvg = ({ stage }) => {
  const width = 28 + stage * 5;
  const bumps = stage >= 5 ? 4 : stage >= 4 ? 2 : 0;
  const folds = stage >= 3 ? Math.min(stage - 1, 5) : 0;
  const cx = 50;
  const top = 12;
  const bottom = 118;
  const mid = 70;

  return (
    <svg viewBox="0 0 100 130" className="mx-auto h-36 w-full max-w-[140px]" aria-hidden>
      {/* thigh */}
      <path
        d={`M${cx - width * 0.55} ${top} Q${cx} ${top - 4} ${cx + width * 0.55} ${top}
            L${cx + width * 0.7} ${mid} Q${cx} ${mid + 4} ${cx - width * 0.7} ${mid} Z`}
        fill="#c7d2fe"
        stroke="#4338ca"
        strokeWidth="1.5"
      />
      {/* lower leg */}
      <path
        d={`M${cx - width * 0.65} ${mid}
            L${cx - width * (0.75 + stage * 0.04)} ${bottom - 18}
            Q${cx} ${bottom - 8} ${cx + width * (0.75 + stage * 0.04)} ${bottom - 18}
            L${cx + width * 0.65} ${mid}
            Q${cx} ${mid + 6} ${cx - width * 0.65} ${mid} Z`}
        fill={stage >= 6 ? "#a5b4fc" : "#c7d2fe"}
        stroke="#4338ca"
        strokeWidth="1.5"
      />
      {/* foot */}
      <ellipse cx={cx + 6} cy={bottom - 4} rx={14 + stage} ry={7 + stage * 0.4} fill="#818cf8" stroke="#4338ca" strokeWidth="1.2" />
      {/* skin folds */}
      {Array.from({ length: folds }).map((_, i) => (
        <path
          key={i}
          d={`M${cx - width * 0.45} ${mid + 10 + i * 8} Q${cx} ${mid + 14 + i * 8} ${cx + width * 0.45} ${mid + 10 + i * 8}`}
          fill="none"
          stroke="#6366f1"
          strokeWidth="1.2"
        />
      ))}
      {/* nodules / papillomatosis */}
      {Array.from({ length: bumps }).map((_, i) => (
        <circle
          key={i}
          cx={cx - 10 + i * 8}
          cy={mid + 28 + (i % 2) * 10}
          r={2.5 + (stage >= 6 ? 1.5 : 0)}
          fill="#4f46e5"
        />
      ))}
      {stage >= 2 && (
        <text x={cx} y={mid - 8} textAnchor="middle" className="fill-indigo-900" style={{ fontSize: 8, fontWeight: 700 }}>
          {stage === 1 ? "subsides" : stage === 2 ? "persists" : ""}
        </text>
      )}
    </svg>
  );
};

const STAGES = [
  { code: "S1", title: "Stage 1 — Reversible Swelling", desc: "Pitting edema that subsides overnight." },
  { code: "S2", title: "Stage 2 — Persistent swelling", desc: "Pitting edema remains; does not fully resolve with rest." },
  { code: "S3", title: "Stage 3 — Early skin changes", desc: "Shallow folds, beginning fibrosis." },
  { code: "S4", title: "Stage 4 — Moderate fibrosis", desc: "Skin thickening, deeper folds, early nodules." },
  { code: "S5", title: "Stage 5 — Severe fibrosis", desc: "Papillomatosis, wart-like growths, recurrent infections." },
  { code: "S6", title: "Stage 6 — Advanced elephantiasis", desc: "Gross enlargement, skin hardening, deformity." },
  { code: "S7", title: "Stage 7 — End-stage elephantiasis", desc: "Extreme deformity, disability, loss of function." },
];

export default function LfStageHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-11" data-testid="lf-stage-help-btn">
          <CircleHelp className="mr-2 h-4 w-4" /> Help — LF stages
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl" data-testid="lf-stage-help-dialog">
        <DialogHeader>
          <DialogTitle className="font-head text-xl">Lymphatic Filariasis — staging guide</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Use these illustrations to classify limb findings. Select a stage, then tap the body region. Set secondary infection for each marked site (default None).
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {STAGES.map((s, i) => (
            <div key={s.code} className="rounded-lg border border-border bg-white p-3" data-testid={`lf-stage-card-${s.code}`}>
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded bg-secondary px-2 py-0.5 text-xs font-bold text-primary">{s.code}</span>
                <p className="font-semibold text-sm leading-snug">{s.title}</p>
              </div>
              <StageSvg stage={i + 1} />
              <p className="mt-2 text-xs text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
