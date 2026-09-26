import { Check } from "lucide-react";
import { fmtDate } from "@/mock/specs";
import { groupVaccinesByFamily } from "@/mock/wellbaby";

const cardWidth = "w-[calc((100%-1rem)/3)]";

const statusClass = (rec, overdue) =>
  rec?.given ? "border-green-500 bg-green-50" : overdue ? "border-red-500 bg-red-50" : "border-border bg-white";

/** Read-only dashboard chips: check + name + Given/Due line. */
export function ImmunizationDashCards({ vaccines = [], records = {}, getDue, getOverdue, testidPrefix = "dash-vac" }) {
  return (
    <div className="space-y-2">
      {groupVaccinesByFamily(vaccines).map((group) => (
        <div key={group.family} className="flex flex-wrap gap-2" data-testid={`${testidPrefix}-group-${group.family}`}>
          {group.doses.map((item) => {
            const rec = records[item.id];
            const overdue = getOverdue?.(item, rec) || false;
            const due = getDue?.(item);
            return (
              <div
                key={item.id}
                className={`flex ${cardWidth} items-start gap-1.5 rounded-md border p-2 ${statusClass(rec, overdue)}`}
                data-testid={`${testidPrefix}-${item.id}`}
              >
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center">
                  {rec?.given && <Check className="h-3.5 w-3.5 text-green-600" strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm font-semibold leading-tight">{item.name}</p>
                  <p className={`text-[10px] leading-snug ${rec?.given ? "font-semibold text-green-700" : overdue ? "font-semibold text-red-700" : "text-muted-foreground"}`}>
                    {rec?.given
                      ? `Given ${rec.date ? fmtDate(rec.date) : ""}`
                      : overdue
                        ? `Overdue · due ${due ? fmtDate(due) : "—"}`
                        : `Due ${due ? fmtDate(due) : "—"}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Entry cards: bordered checkbox before name, compact date when given. */
export function ImmunizationEntryCards({
  vaccines = [],
  records = {},
  getDue,
  getOverdue,
  onToggle,
  onSetDate,
  testidPrefix = "vac",
}) {
  return (
    <div className="space-y-2">
      {groupVaccinesByFamily(vaccines).map((group) => (
        <div key={group.family} className="flex flex-wrap gap-2" data-testid={`${testidPrefix}-group-${group.family}`}>
          {group.doses.map((item) => {
            const rec = records[item.id];
            const overdue = getOverdue?.(item, rec) || false;
            const due = getDue?.(item);
            return (
              <div
                key={item.id}
                className={`${cardWidth} space-y-1.5 rounded-md border p-2 ${statusClass(rec, overdue)}`}
                data-testid={`${testidPrefix}-${item.id}`}
              >
                <div className="flex items-start gap-1.5">
                  <button
                    type="button"
                    onClick={() => onToggle?.(item)}
                    data-testid={`${testidPrefix}-toggle-${item.id}`}
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${
                      rec?.given ? "border-green-600 bg-green-600 text-white" : "border-input bg-white"
                    }`}
                    aria-label={rec?.given ? "Mark not given" : "Mark given"}
                  >
                    {rec?.given && <Check className="h-3 w-3" strokeWidth={3} />}
                  </button>
                  <p className="min-w-0 flex-1 text-sm leading-snug">
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {" "}· {item.note} · due {due ? fmtDate(due) : "—"}{overdue ? " · OVERDUE" : ""}
                    </span>
                  </p>
                </div>
                {rec?.given ? (
                  <input
                    type="date"
                    className="h-7 w-[7.5rem] max-w-full rounded border border-input bg-white px-1.5 text-[11px]"
                    value={rec.date || ""}
                    onChange={(e) => onSetDate?.(item.id, e.target.value)}
                    data-testid={`${testidPrefix}-date-${item.id}`}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
