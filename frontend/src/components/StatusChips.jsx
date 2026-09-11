import { Badge } from "@/components/ui/badge";
import { DISEASE_SPECS } from "@/mock/specs";

const chipCls = "shrink-0 rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide";

/** Unsynced indicator — place on the right of the row next to action icons */
export function PendingSyncChip({ pending, testid }) {
  if (!pending) return null;
  return (
    <Badge
      variant="outline"
      className={`${chipCls} border-orange-300 bg-orange-50 text-orange-800`}
      data-testid={testid}
    >
      Pending Sync
    </Badge>
  );
}

/** Disease · Diagnosis (optional) · Outcome (optional) */
export default function StatusChips({ diseaseId, diagnosis, outcome, testid }) {
  const disease = DISEASE_SPECS[diseaseId]?.name || diseaseId;
  const dx = diagnosis && diagnosis !== "—" ? diagnosis : "";
  const out = outcome && outcome !== "—" ? outcome : "";
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5" data-testid={testid}>
      {disease && <Badge className={`${chipCls} bg-primary text-white`}>{disease}</Badge>}
      {dx && (
        <Badge variant="outline" className={chipCls}>
          {dx}
        </Badge>
      )}
      {out && (
        <Badge variant="outline" className={chipCls}>
          {out}
        </Badge>
      )}
    </div>
  );
}
