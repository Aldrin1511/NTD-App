import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Slider } from "@/components/ui/slider";
import {
  STANDARDS, GROWTH_MODES, GROWTH_METRICS, metricApplies, compute, bmiFrom, referenceSeries,
  percentileLabel, monthsBetween, ageMonthsToLabel,
} from "@/mock/growth";
import { Activity } from "lucide-react";

const dot = { green: "bg-green-500", amber: "bg-amber-500", red: "bg-red-500", "": "bg-slate-300" };
const txt = { green: "text-green-700", amber: "text-amber-700", red: "text-red-700", "": "text-foreground" };
const ring = { green: "border-green-500", amber: "border-amber-500", red: "border-red-500", "": "border-border" };
const METRIC_COLORS = { weight: "#0F52BA", height: "#059669", hc: "#7c3aed", muac: "#d97706", bmi: "#db2777", wfl: "#0ea5e9" };

const Toggle = ({ options, value, onChange, testid }) => (
  <div className="inline-flex overflow-hidden rounded-md border border-border" data-testid={testid}>
    {options.map((o) => (
      <button key={o} type="button" data-testid={`${testid}-${o.toLowerCase()}`} onClick={() => onChange(o)}
        className={`h-9 px-3 text-sm font-semibold ${value === o ? "bg-primary text-white" : "bg-white text-muted-foreground hover:bg-muted"}`}>{o}</button>
    ))}
  </div>
);

const ChipMulti = ({ options, values, onToggle, testid }) => (
  <div className="flex flex-wrap gap-2" data-testid={testid}>
    {options.map((o) => {
      const key = o.k ?? o;
      const label = o.label ?? o;
      const on = values.includes(key);
      return (
        <button key={key} type="button" onClick={() => onToggle(key)} data-testid={`${testid}-${String(key).toLowerCase()}`}
          className={`h-8 rounded-full border px-3 text-sm font-semibold ${on ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-muted"}`}>{label}</button>
      );
    })}
  </div>
);

const fmtColDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${d.getDate()} ${m} ${d.getFullYear()} ${time}`;
};

/** Entry: sliders for one visit's measurements with live percentile / SD / colour. */
export const GrowthEntry = ({ sex, ageMonths, value = {}, onChange, testid = "growth" }) => {
  const standard = value.standard || "WHO";
  const mode = value.mode || "Percentile";
  const measures = value.measures || {};
  const setMeasure = (k, v) => onChange({ ...value, standard, mode, measures: { ...measures, [k]: v } });
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
                <span className={`text-lg font-bold tabular-nums ${txt[r.status]}`}>{has ? v : "—"}<span className="ml-1 text-xs font-medium text-muted-foreground">{m.unit}</span></span>
              </div>
              <Slider className="mt-3" min={m.min} max={m.max} step={m.step} value={[cur]} onValueChange={([nv]) => setMeasure(m.k, Math.round(nv / m.step) * m.step)} data-testid={`${testid}-${m.k}-slider`} />
              {has && r.z != null && (
                <p className="mt-2 text-xs font-semibold">
                  <span className={`inline-block h-2 w-2 rounded-full ${dot[r.status]} mr-1 align-middle`} />
                  {mode === "SD" ? `${r.z > 0 ? "+" : ""}${r.z} SD` : `${percentileLabel(r.percentile)} pct`} <span className="font-normal text-muted-foreground">(median {r.median}{m.unit})</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
      {metricApplies("bmi", ageMonths) && setBmi() && (() => {
        const r = compute({ metric: "bmi", value: setBmi(), ageMonths, sex, standard });
        return <div className={`rounded-md border ${ring[r.status]} bg-white p-3`} data-testid={`${testid}-bmi`}><span className="text-xs font-semibold text-muted-foreground">BMI (auto)</span> <span className={`font-bold ${txt[r.status]}`}>{setBmi()} kg/m² · {mode === "SD" ? `${r.z > 0 ? "+" : ""}${r.z} SD` : `${percentileLabel(r.percentile)} pct`}</span></div>;
      })()}
    </div>
  );
};

/** Review: table + graph across all growth entries in the episode. */
export const GrowthReview = ({ sex, dob, entries = [], testid = "growth-review" }) => {
  const [metrics, setMetrics] = useState(() => GROWTH_METRICS.map((m) => m.k));
  const [standards, setStandards] = useState(() => [entries[0]?.standard || "WHO"]);
  const [mode, setMode] = useState("Percentile");
  const [showGraph, setShowGraph] = useState(true);

  const standard = standards[0] || "WHO";

  const toggleMetric = (k) => {
    setMetrics((prev) => {
      if (prev.includes(k)) return prev.length === 1 ? prev : prev.filter((x) => x !== k);
      return [...prev, k];
    });
  };

  const toggleStandard = (s) => {
    setStandards((prev) => {
      if (prev.includes(s)) return prev.length === 1 ? prev : prev.filter((x) => x !== s);
      return [...prev, s];
    });
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
      if (w && h) measures.wfl = Math.round((w / h) * 1000) / 1000;
      byDate.set(e.date, { date: e.date, ageMo, measures, standard: std });
    });
    return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [entries, dob, standard]);

  const paramRows = useMemo(() => {
    const rows = GROWTH_METRICS.map((m) => ({
      k: m.k,
      label: `${m.label} (${m.unit})`,
      forAge: m.forAge || "For Age",
      unit: m.unit,
    }));
    rows.push({ k: "wfl", label: "Weight For Length (kg/cm)", forAge: "", unit: "kg/cm" });
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

  const graph = useMemo(() => {
    const single = metrics.length === 1 ? metrics[0] : null;
    const selectedRows = rows.filter((r) => metrics.includes(r.metric) && r.metric !== "wfl");
    const ages = selectedRows.map((r) => r.ageMo / 12);
    const minMo = Math.max(0, Math.min(...ages.map((a) => a * 12), 0));
    const maxMo = Math.max(24, ...ages.map((a) => a * 12 + 6), 24);

    const byAge = {};
    if (single && single !== "wfl") {
      const ref = referenceSeries(single, sex, standard, minMo, Math.min(216, maxMo), 6);
      ref.forEach((p) => { byAge[p.age] = { ...p }; });
      selectedRows.forEach((r) => {
        const age = Math.round((r.ageMo / 12) * 10) / 10;
        byAge[age] = { ...(byAge[age] || { age }), value: Number(r.value) };
      });
    } else {
      selectedRows.forEach((r) => {
        const age = Math.round((r.ageMo / 12) * 10) / 10;
        byAge[age] = { ...(byAge[age] || { age }), [`value_${r.metric}`]: Number(r.value) };
      });
    }
    return Object.values(byAge).sort((a, b) => a.age - b.age);
  }, [rows, metrics, sex, standard]);

  const singleMetric = metrics.length === 1 ? metrics[0] : null;
  const mLabel = GROWTH_METRICS.find((m) => m.k === singleMetric)?.label || singleMetric;

  const cellValue = (col, k) => {
    const v = col.measures?.[k];
    return v === undefined || v === null || v === "" ? "" : v;
  };

  return (
    <div className="space-y-4" data-testid={testid}>
      <div className="flex flex-wrap items-center gap-3">
        <ChipMulti options={STANDARDS.map((s) => ({ k: s, label: s }))} values={standards} onToggle={toggleStandard} testid={`${testid}-standard`} />
        <Toggle options={GROWTH_MODES} value={mode} onChange={setMode} testid={`${testid}-mode`} />
        <button type="button" onClick={() => setShowGraph((v) => !v)} data-testid={`${testid}-toggle-graph`}
          className="ml-auto text-sm font-semibold text-primary hover:underline">{showGraph ? "Hide Graph" : "Show Graph"}</button>
      </div>

      {showGraph && (
        <>
          <div className="flex flex-wrap gap-2">
            {GROWTH_METRICS.map((m) => {
              const on = metrics.includes(m.k);
              return (
                <button key={m.k} type="button" onClick={() => toggleMetric(m.k)} data-testid={`${testid}-metric-${m.k}`}
                  className={`h-9 rounded-full border px-3 text-sm font-semibold ${on ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-muted"}`}>{m.label}</button>
              );
            })}
          </div>

          <div className="h-64 w-full rounded-lg border border-border bg-white p-2" data-testid={`${testid}-graph`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={graph} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef" />
                <XAxis dataKey="age" tick={{ fontSize: 11 }} label={{ value: "Age (yr)", position: "insideBottom", offset: -2, fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {singleMetric && singleMetric !== "wfl" && (
                  <>
                    <Line type="monotone" dataKey="p2" name="+2SD" stroke="#f59e0b" dot={false} strokeWidth={1} />
                    <Line type="monotone" dataKey="median" name="Median" stroke="#94a3b8" dot={false} strokeWidth={1} />
                    <Line type="monotone" dataKey="m2" name="-2SD" stroke="#f59e0b" dot={false} strokeWidth={1} />
                    <Line type="monotone" dataKey="value" name={mLabel} stroke={METRIC_COLORS[singleMetric] || "#0F52BA"} strokeWidth={2.5} connectNulls dot={{ r: 4 }} />
                  </>
                )}
                {(!singleMetric || singleMetric === "wfl") && metrics.filter((k) => k !== "wfl").map((k) => {
                  const m = GROWTH_METRICS.find((x) => x.k === k);
                  return (
                    <Line key={k} type="monotone" dataKey={`value_${k}`} name={m?.label || k} stroke={METRIC_COLORS[k] || "#0F52BA"} strokeWidth={2.5} connectNulls dot={{ r: 4 }} />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div className="overflow-x-auto rounded-md border border-border" data-testid={`${testid}-table`}>
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/60 text-left">
              <th className="sticky left-0 bg-muted/60 px-3 py-2.5 text-sm font-semibold text-foreground">Parameters</th>
              {visitCols.map((col) => (
                <th key={col.date} className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-semibold text-foreground">{fmtColDate(col.date)}</th>
              ))}
              {visitCols.length === 0 && <th className="px-4 py-2.5 text-right text-sm font-normal text-muted-foreground">No visits</th>}
            </tr>
          </thead>
          <tbody>
            {paramRows.map((p, i) => (
              <tr key={p.k} className={`border-b border-border/70 ${i % 2 === 1 ? "bg-muted/30" : "bg-white"}`} data-testid={`${testid}-row-${p.k}`}>
                <td className={`sticky left-0 px-3 py-2.5 ${i % 2 === 1 ? "bg-muted/30" : "bg-white"}`}>
                  <div className="flex items-start gap-2">
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
