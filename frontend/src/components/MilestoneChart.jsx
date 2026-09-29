import { useRef } from "react";
import { Calendar, Trash2 } from "lucide-react";
import { MILESTONES, milestoneFlag } from "@/mock/wellbaby";
import { fmtDate } from "@/mock/specs";

/** Chart window (months) — matches common WHO gross-motor timeline views. */
const AXIS_MIN = 3;
const AXIS_MAX = 21;
const AXIS_SPAN = AXIS_MAX - AXIS_MIN;
const TICKS = Array.from({ length: AXIS_MAX - AXIS_MIN + 1 }, (_, i) => AXIS_MIN + i);
const MARKER = "#e08a3c";

/** Neutral default; after date select: green (on/early) → amber (≤2 wk late) → red. */
const barColor = (flag) => {
  if (flag === "green") return "#22c55e";
  if (flag === "amber") return "#f59e0b";
  if (flag === "red") return "#ef4444";
  return "#f0c9a0";
};

/** Advanced milestones at top (same order as reference chart). */
const CHART_ROWS = [...MILESTONES].reverse();

const pct = (mo) => Math.min(100, Math.max(0, ((mo - AXIS_MIN) / AXIS_SPAN) * 100));

/** Fractional age in months for placing achievement ticks on the axis. */
function ageMonthsPrecise(dob, ref) {
  if (!dob || !ref) return null;
  const a = new Date(dob);
  const b = new Date(ref);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  const days = b.getDate() - a.getDate();
  if (days < 0) {
    const prevDays = new Date(b.getFullYear(), b.getMonth(), 0).getDate();
    months -= 1;
    months += (prevDays + days) / prevDays;
  } else {
    const dim = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate();
    months += days / dim;
  }
  return Math.max(0, months);
}

/**
 * WHO gross-motor milestone timeline (Gantt-style): name + date left, expected-age bars right.
 */
export default function MilestoneChart({
  records = {},
  dob,
  ageMonths = null,
  readOnly = false,
  onSetDate,
  onClear,
  onToggle,
  testid = "wb-milestones",
}) {
  const ageLine =
    ageMonths != null && ageMonths >= AXIS_MIN && ageMonths <= AXIS_MAX ? pct(ageMonths) : null;

  return (
    <div className="overflow-x-auto" data-testid={testid}>
      <div className="min-w-[720px]">
        <div className="overflow-hidden rounded-md border border-border bg-white">
          {CHART_ROWS.map((m) => {
            const rec = records[m.id];
            const achieved = !!rec?.achieved;
            const left = pct(m.min);
            const width = Math.max(2, pct(m.max) - pct(m.min));
            const achievedMo = achieved && rec?.date ? ageMonthsPrecise(dob, rec.date) : null;
            const marker =
              achievedMo != null && achievedMo >= AXIS_MIN && achievedMo <= AXIS_MAX
                ? pct(achievedMo)
                : null;
            const flag = milestoneFlag(m, rec, ageMonths, achievedMo);

            return (
              <MilestoneRow
                key={m.id}
                milestone={m}
                rec={rec}
                achieved={achieved}
                flag={flag}
                left={left}
                width={width}
                marker={marker}
                ageLine={ageLine}
                readOnly={readOnly}
                onToggle={onToggle}
                onSetDate={onSetDate}
                onClear={onClear}
              />
            );
          })}

          {/* Age axis */}
          <div className="flex border-t border-border">
            <div className="flex w-[280px] shrink-0 items-center px-3 py-2 text-xs font-medium text-muted-foreground sm:w-[300px]">
              Age in Months
            </div>
            <div className="relative h-8 flex-1 border-l border-border bg-[#fafafa]">
              <div className="pointer-events-none absolute inset-0 flex">
                {TICKS.map((t) => (
                  <div key={t} className="flex-1 border-l border-border/50 first:border-l-0" />
                ))}
              </div>
              {TICKS.map((t) => (
                <span
                  key={t}
                  className={`absolute bottom-1.5 text-[10px] tabular-nums text-muted-foreground ${
                    t === AXIS_MIN ? "translate-x-0" : t === AXIS_MAX ? "-translate-x-full" : "-translate-x-1/2"
                  }`}
                  style={{ left: `${pct(t)}%` }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MilestoneRow({
  milestone: m,
  rec,
  achieved,
  flag,
  left,
  width,
  marker,
  ageLine,
  readOnly,
  onToggle,
  onSetDate,
  onClear,
}) {
  const dateRef = useRef(null);

  const openPicker = () => {
    if (readOnly) return;
    const el = dateRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") el.showPicker();
    else el.click();
  };

  return (
    <div className="flex border-b border-border/80 last:border-b-0" data-testid={`wb-ms-${m.id}`}>
      {/* Left: name + date + actions */}
      <div className="flex w-[280px] shrink-0 items-center gap-2 px-3 py-2.5 sm:w-[300px]">
        <button
          type="button"
          disabled={readOnly}
          onClick={() => onToggle?.(m)}
          className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground disabled:cursor-default"
          data-testid={`wb-ms-toggle-${m.id}`}
          title={readOnly ? undefined : achieved ? "Mark not achieved" : "Mark achieved today"}
        >
          {m.name}
        </button>

        <span
          className={`w-[5.5rem] shrink-0 text-right text-xs tabular-nums ${
            achieved ? "text-foreground" : "text-muted-foreground"
          }`}
          data-testid={`wb-ms-date-label-${m.id}`}
        >
          {achieved && rec?.date ? fmtDate(rec.date) : "—"}
        </span>

        {!readOnly && (
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={openPicker}
              aria-label={`Set date for ${m.name}`}
              data-testid={`wb-ms-cal-${m.id}`}
            >
              <Calendar className="h-3.5 w-3.5" />
            </button>
            <input
              ref={dateRef}
              type="date"
              className="sr-only"
              value={rec?.date || ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v) onSetDate?.(m.id, v);
              }}
              data-testid={`wb-ms-date-${m.id}`}
            />
            <button
              type="button"
              disabled={!achieved}
              className="grid h-7 w-7 place-items-center rounded text-red-500 hover:bg-red-50 disabled:invisible"
              onClick={() => onClear?.(m.id)}
              aria-label={`Clear ${m.name}`}
              data-testid={`wb-ms-clear-${m.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Right: expected-age bar + achievement tick */}
      <div className="relative min-h-[2.75rem] flex-1 border-l border-border bg-[#fafafa]">
        <div className="pointer-events-none absolute inset-0 flex">
          {TICKS.map((t) => (
            <div key={t} className="flex-1 border-l border-border/40 first:border-l-0" />
          ))}
        </div>

        {/* Current age (visit) line */}
        {ageLine != null && (
          <div
            className="pointer-events-none absolute inset-y-0 z-10 w-px bg-[#5b7fd4]/80"
            style={{ left: `${ageLine}%` }}
            title="Current age"
          />
        )}

        {/* WHO expected window — risk color */}
        <div
          className="absolute top-1/2 z-[1] h-6 -translate-y-1/2 rounded-[3px]"
          style={{ left: `${left}%`, width: `${width}%`, backgroundColor: barColor(flag) }}
          title={`Expected ${m.min}–${m.max} mo`}
        />

        {/* Achievement tick (vertical orange marker) */}
        {marker != null && (
          <div
            className="absolute top-1/2 z-[2] h-7 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-sm"
            style={{ left: `${marker}%`, backgroundColor: MARKER }}
            title={`Achieved at ${fmtDate(rec.date)}`}
          />
        )}
      </div>
    </div>
  );
}
