import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  STANDARDS, GROWTH_MODES, GROWTH_METRICS, metricApplies, compute, bmiFrom, referenceSeries,
  percentileLabel, monthsBetween, ageMonthsToLabel,
} from "@/mock/growth";
import { Activity, Check, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const dot = { green: "bg-green-500", amber: "bg-amber-500", red: "bg-red-500", "": "bg-slate-300" };
const txt = { green: "text-green-700", amber: "text-amber-700", red: "text-red-700", "": "text-foreground" };
const ring = { green: "border-green-500", amber: "border-amber-500", red: "border-red-500", "": "border-border" };
const METRIC_COLORS = { weight: "#dc2626", height: "#dc2626", hc: "#dc2626", muac: "#dc2626", bmi: "#dc2626", wfl: "#dc2626" };

/** Clinical growth-chart percentile band colors (outer → inner). */
const PCT_LINES = [
  { key: "p3", stroke: "#7c2d12", width: 1.5 },
  { key: "p15", stroke: "#ea580c", width: 1.5 },
  { key: "p50", stroke: "#86efac", width: 2 },
  { key: "p85", stroke: "#ea580c", width: 1.5 },
  { key: "p97", stroke: "#7c2d12", width: 1.5 },
];
const SD_LINES = [
  { key: "m2", stroke: "#7c2d12", width: 1.5, name: "-2SD" },
  { key: "median", stroke: "#86efac", width: 2, name: "Median" },
  { key: "p2", stroke: "#7c2d12", width: 1.5, name: "+2SD" },
];

const Toggle = ({ options, value, onChange, testid }) => (
  <div className="inline-flex overflow-hidden rounded-md border border-border" data-testid={testid}>
    {options.map((o) => (
      <button key={o} type="button" data-testid={`${testid}-${o.toLowerCase()}`} onClick={() => onChange(o)}
        className={`h-9 px-3 text-sm font-semibold ${value === o ? "bg-primary text-white" : "bg-white text-muted-foreground hover:bg-muted"}`}>{o}</button>
    ))}
  </div>
);

const fmtColDateParts = (v) => {
  if (!v) return { date: "—", time: "" };
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return { date: String(v), time: "" };
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  return {
    date: `${d.getDate()} ${m} ${d.getFullYear()}`,
    time,
  };
};

const fmtMeasure = (v) => {
  if (v === undefined || v === null || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toFixed(1);
};

const round1 = (n) => Math.round(Number(n) * 10) / 10;

/** Age window for chart X-axis (months), shaped like clinical growth charts. */
const ageWindowMonths = (metric, ageMos = []) => {
  const ages = ageMos.filter((a) => a != null && Number.isFinite(a));
  const latest = ages.length ? Math.max(...ages) : 24;
  if (metric === "hc" || metric === "muac") return { from: 0, to: Math.max(24, Math.ceil(latest / 6) * 6 + 6), step: 1 };
  if (metric === "bmi") return { from: 24, to: Math.max(60, Math.ceil(latest / 6) * 6 + 6), step: 1 };
  if (metric === "height" && latest >= 24) return { from: 24, to: Math.max(60, Math.ceil(latest / 6) * 6 + 6), step: 1 };
  return { from: 0, to: Math.max(60, Math.ceil(latest / 6) * 6 + 6), step: 1 };
};

/** Build chart series for one metric (percentile bands + patient points). */
const buildMetricGraph = (metric, rows, sex, standard) => {
  const selectedRows = rows.filter((r) => r.metric === metric);
  const ageMos = selectedRows.map((r) => r.ageMo);
  const { from, to, step } = ageWindowMonths(metric, ageMos);
  const byMo = {};

  if (metric !== "wfl") {
    referenceSeries(metric, sex, standard, from, to, step).forEach((p) => {
      byMo[p.months] = { ...p };
    });
  } else {
    for (let a = from; a <= to; a += step) byMo[a] = { months: a };
  }

  selectedRows.forEach((r) => {
    const mo = Math.round(r.ageMo);
    byMo[mo] = { ...(byMo[mo] || { months: mo }), value: Number(r.value) };
  });

  return Object.values(byMo).sort((a, b) => a.months - b.months);
};

const MetricGraph = ({ metric, label, unit, data, mode, testid, selected, onSelect, tall = false }) => {
  const bands = mode === "SD" ? SD_LINES : PCT_LINES;
  return (
    <div
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={() => onSelect?.(metric)}
      onKeyDown={(e) => {
        if (!onSelect) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(metric);
        }
      }}
      className={`relative rounded-md border bg-[#fafafa] p-2 transition-shadow ${
        tall ? "h-[min(78vh,40rem)]" : "h-72"
      } ${
        selected
          ? "border-primary shadow-md ring-2 ring-primary/25"
          : "border-border/60 hover:border-primary/50"
      } ${onSelect ? "cursor-pointer" : ""}`}
      data-testid={testid}
      title={onSelect ? "Click to view full screen" : undefined}
    >
      {onSelect && !tall && (
        <span className="pointer-events-none absolute right-2 top-2 z-10 rounded bg-white/90 p-1 text-primary shadow-sm">
          <Maximize2 className="h-3.5 w-3.5" />
        </span>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 28, left: 8 }}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="0" />
          <XAxis
            dataKey="months"
            type="number"
            domain={["dataMin", "dataMax"]}
            tick={{ fontSize: tall ? 12 : 10, angle: -45, textAnchor: "end" }}
            height={48}
            tickCount={12}
            label={{ value: `Months - ${label}`, position: "insideBottom", offset: -4, fontSize: tall ? 13 : 11, fill: "#475569" }}
          />
          <YAxis
            tick={{ fontSize: tall ? 12 : 10 }}
            domain={["auto", "auto"]}
            width={tall ? 48 : 40}
            label={{ value: unit || "", angle: -90, position: "insideLeft", offset: 8, fontSize: tall ? 13 : 11, fill: "#475569" }}
          />
          <Tooltip formatter={(v) => [fmtMeasure(v), ""]} labelFormatter={(m) => `${m} mo`} />
          {metric !== "wfl" && bands.map((b) => (
            <Line
              key={b.key}
              type="monotone"
              dataKey={b.key}
              name={b.name || `${b.key.replace("p", "")}${mode === "Percentile" ? "th" : ""}`}
              stroke={b.stroke}
              strokeWidth={b.width}
              dot={false}
              isAnimationActive={false}
              legendType="none"
            />
          ))}
          <Line
            type="monotone"
            dataKey="value"
            name={label}
            stroke={METRIC_COLORS[metric] || "#dc2626"}
            strokeWidth={0}
            connectNulls
            isAnimationActive={false}
            dot={{ r: tall ? 6 : 5, fill: "#dc2626", stroke: "#fff", strokeWidth: 1.5 }}
            activeDot={{ r: tall ? 7 : 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

/** Entry: sliders for one visit's measurements with live percentile / SD / colour. */
export const GrowthEntry = ({ sex, ageMonths, value = {}, onChange, testid = "growth" }) => {
  const standard = value.standard || "WHO";
  const mode = value.mode || "Percentile";
  const measures = value.measures || {};
  const setMeasure = (k, v) => onChange({ ...value, standard, mode, measures: { ...measures, [k]: round1(v) } });
  const setBmi = () => bmiFrom(measures.weight, measures.height);

  return (
    <div className="space-y-4" data-testid={testid}>
      <div className="flex flex-wrap items-center gap-3">
        <div><p className="mb-1 text-[11px] font-semibold text-muted-foreground">Standard</p><Toggle options={STANDARDS} value={standard} onChange={(v) => onChange({ ...value, standard: v, mode, measures })} testid={`${testid}-standard`} /></div>
        <div><p className="mb-1 text-[11px] font-semibold text-muted-foreground">Show as</p><Toggle options={GROWTH_MODES} value={mode} onChange={(v) => onChange({ ...value, standard, mode: v, measures })} testid={`${testid}-mode`} /></div>
        <div className="ml-auto text-right"><p className="text-[11px] font-semibold text-muted-foreground">Age at visit</p><p className="font-bold">{ageMonthsToLabel(ageMonths)}</p></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {GROWTH_METRICS.filter((m) => !m.derived && metricApplies(m.k, ageMonths)).map((m) => {
          const v = measures[m.k];
          const r = compute({ metric: m.k, value: v, ageMonths, sex, standard });
          const has = v !== undefined && v !== "" && v !== null;
          const cur = has ? Number(v) : (m.min + m.max) / 2;
          return (
            <div key={m.k} className={`rounded-md border ${ring[r.status]} bg-white p-3`} data-testid={`${testid}-${m.k}`}>
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold text-muted-foreground">{m.label} ({m.unit})</span>
                <span className={`text-lg font-bold tabular-nums ${txt[r.status]}`}>{has ? fmtMeasure(v) : "—"}<span className="ml-1 text-xs font-medium text-muted-foreground">{m.unit}</span></span>
              </div>
              <Slider className="mt-3" min={m.min} max={m.max} step={m.step} value={[cur]} onValueChange={([nv]) => setMeasure(m.k, Math.round(nv / m.step) * m.step)} data-testid={`${testid}-${m.k}-slider`} />
              {has && r.z != null && (
                <p className="mt-2 text-xs font-semibold">
                  <span className={`inline-block h-2 w-2 rounded-full ${dot[r.status]} mr-1 align-middle`} />
                  {mode === "SD" ? `${r.z > 0 ? "+" : ""}${Number(r.z).toFixed(1)} SD` : `${percentileLabel(r.percentile)} pct`} <span className="font-normal text-muted-foreground">(median {fmtMeasure(r.median)}{m.unit})</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
      {metricApplies("bmi", ageMonths) && setBmi() && (() => {
        const r = compute({ metric: "bmi", value: setBmi(), ageMonths, sex, standard });
        return <div className={`rounded-md border ${ring[r.status]} bg-white p-3`} data-testid={`${testid}-bmi`}><span className="text-xs font-semibold text-muted-foreground">BMI (auto)</span> <span className={`font-bold ${txt[r.status]}`}>{fmtMeasure(setBmi())} kg/m² · {mode === "SD" ? `${r.z > 0 ? "+" : ""}${Number(r.z).toFixed(1)} SD` : `${percentileLabel(r.percentile)} pct`}</span></div>;
      })()}
    </div>
  );
};

/** Review: parameter checkboxes drive which metric graphs appear. */
export const GrowthReview = ({ sex, dob, entries = [], testid = "growth-review" }) => {
  const [selected, setSelected] = useState(["height"]);
  const [standard, setStandard] = useState(() => entries[0]?.standard || "WHO");
  const [mode, setMode] = useState("Percentile");
  const [showGraph, setShowGraph] = useState(true);
  const [focusMetric, setFocusMetric] = useState(null);

  const toggleMetric = (k) => {
    setSelected((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  };

  const visitCols = useMemo(() => {
    const byDate = new Map();
    entries.forEach((e) => {
      const ageMo = e.ageMonths != null ? e.ageMonths : monthsBetween(dob, e.date);
      const std = e.standard || standard;
      const measures = { ...(e.measures || {}) };
      const bmi = bmiFrom(measures.weight, measures.height);
      if (bmi && ageMo >= 24) measures.bmi = bmi;
      const w = Number(measures.weight);
      const h = Number(measures.height);
      if (w && h) measures.wfl = Number((w / h).toFixed(1));
      byDate.set(e.date, { date: e.date, ageMo, measures, standard: std });
    });
    return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [entries, dob, standard]);

  const paramRows = useMemo(() => {
    const rows = GROWTH_METRICS.map((m) => ({
      k: m.k,
      label: `${m.label} (${m.unit})`,
      name: m.label,
      forAge: m.forAge || "For Age",
      unit: m.unit,
    }));
    rows.push({ k: "wfl", label: "Weight For Length (kg/cm)", name: "Weight For Length", forAge: "", unit: "kg/cm" });
    return rows;
  }, []);

  const rows = useMemo(() => {
    const out = [];
    visitCols.forEach((col) => {
      Object.entries(col.measures || {}).forEach(([k, val]) => {
        if (val == null || val === "") return;
        if (k === "wfl") {
          out.push({ date: col.date, ageMo: col.ageMo, metric: k, value: val, percentile: null, z: null, status: "" });
          return;
        }
        const r = compute({ metric: k, value: val, ageMonths: col.ageMo, sex, standard: col.standard || standard });
        out.push({ date: col.date, ageMo: col.ageMo, metric: k, value: val, ...r });
      });
    });
    return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [visitCols, sex, standard]);

  const cellValue = (col, k) => fmtMeasure(col.measures?.[k]);

  const focusParam = focusMetric ? paramRows.find((r) => r.k === focusMetric) : null;

  return (
    <div className="space-y-4" data-testid={testid}>
      <div className="flex flex-wrap items-center gap-3">
        <Toggle options={STANDARDS} value={standard} onChange={setStandard} testid={`${testid}-standard`} />
        <Toggle options={GROWTH_MODES} value={mode} onChange={setMode} testid={`${testid}-mode`} />
        <button type="button" onClick={() => setShowGraph((v) => !v)} data-testid={`${testid}-toggle-graph`}
          className="ml-auto text-sm font-semibold text-primary hover:underline">{showGraph ? "Hide Graph" : "Show Graph"}</button>
      </div>

      <div className="space-y-3">
        {showGraph && selected.length > 0 && (
          <div className={`grid gap-3 ${selected.length === 1 ? "grid-cols-1" : "sm:grid-cols-2"}`} data-testid={`${testid}-graphs`}>
            {selected.map((k) => {
              const p = paramRows.find((r) => r.k === k);
              return (
                <MetricGraph
                  key={k}
                  metric={k}
                  label={p?.name || k}
                  unit={p?.unit}
                  mode={mode}
                  data={buildMetricGraph(k, rows, sex, standard)}
                  selected={focusMetric === k}
                  onSelect={setFocusMetric}
                  testid={`${testid}-graph-${k}`}
                />
              );
            })}
          </div>
        )}

        <Dialog open={!!focusMetric} onOpenChange={(o) => { if (!o) setFocusMetric(null); }}>
          <DialogContent className="max-h-[95vh] w-[min(96vw,72rem)] max-w-none overflow-y-auto p-4 sm:p-6" data-testid={`${testid}-graph-fullscreen`}>
            <DialogHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pr-8">
              <DialogTitle className="font-head text-lg">
                {focusParam?.name || focusMetric}
                {focusParam?.unit ? ` (${focusParam.unit})` : ""} · full screen
              </DialogTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0"
                onClick={() => setFocusMetric(null)}
                data-testid={`${testid}-graph-close`}
              >
                <X className="mr-1 h-4 w-4" /> Close
              </Button>
            </DialogHeader>
            {focusMetric && (
              <MetricGraph
                metric={focusMetric}
                label={focusParam?.name || focusMetric}
                unit={focusParam?.unit}
                mode={mode}
                data={buildMetricGraph(focusMetric, rows, sex, standard)}
                tall
                selected
                testid={`${testid}-graph-fs-${focusMetric}`}
              />
            )}
          </DialogContent>
        </Dialog>

        <div className="overflow-x-auto rounded-md border border-border" data-testid={`${testid}-table`}>
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60 text-left">
                <th className="sticky left-0 bg-muted/60 px-3 py-2.5 text-sm font-semibold text-foreground">Parameters</th>
                {visitCols.map((col) => {
                  const { date, time } = fmtColDateParts(col.date);
                  return (
                    <th key={col.date} className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-semibold text-foreground">
                      <span className="block leading-tight">{date}</span>
                      {time ? <span className="mt-0.5 block text-xs font-medium text-muted-foreground leading-tight">{time}</span> : null}
                    </th>
                  );
                })}
                {visitCols.length === 0 && <th className="px-4 py-2.5 text-right text-sm font-normal text-muted-foreground">No visits</th>}
              </tr>
            </thead>
            <tbody>
              {paramRows.map((p, i) => {
                const on = selected.includes(p.k);
                return (
                  <tr
                    key={p.k}
                    className={`border-b border-border/70 ${on ? "bg-sky-50" : i % 2 === 1 ? "bg-muted/30" : "bg-white"}`}
                    data-testid={`${testid}-row-${p.k}`}
                  >
                    <td className={`sticky left-0 px-3 py-2.5 ${on ? "bg-sky-50" : i % 2 === 1 ? "bg-muted/30" : "bg-white"}`}>
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => toggleMetric(p.k)}
                          data-testid={`${testid}-check-${p.k}`}
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${
                            on ? "border-primary bg-primary text-white" : "border-input bg-white"
                          }`}
                          aria-label={on ? `Hide ${p.name} graph` : `Show ${p.name} graph`}
                          aria-pressed={on}
                        >
                          {on && <Check className="h-3 w-3" strokeWidth={3} />}
                        </button>
                        <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-500" />
                        <div>
                          <p className="font-semibold leading-tight text-foreground">{p.label}</p>
                          {p.forAge ? <p className="text-xs text-muted-foreground">{p.forAge}</p> : null}
                        </div>
                      </div>
                    </td>
                    {visitCols.map((col) => {
                      const v = cellValue(col, p.k);
                      return (
                        <td key={col.date} className="px-4 py-2.5 text-right tabular-nums font-medium text-foreground">
                          {v === "" ? <span className="text-muted-foreground">—</span> : v}
                        </td>
                      );
                    })}
                    {visitCols.length === 0 && <td className="px-4 py-2.5 text-right text-muted-foreground">—</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
