import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Field } from "@/components/Fields";
import { Slider } from "@/components/ui/slider";
import {
  STANDARDS, GROWTH_MODES, GROWTH_METRICS, metricApplies, compute, bmiFrom, referenceSeries,
  percentileLabel, monthsBetween, ageMonthsToLabel,
} from "@/mock/growth";
import { fmtDateTime, fmtDate } from "@/mock/specs";

const dot = { green: "bg-green-500", amber: "bg-amber-500", red: "bg-red-500", "": "bg-slate-300" };
const txt = { green: "text-green-700", amber: "text-amber-700", red: "text-red-700", "": "text-foreground" };
const ring = { green: "border-green-500", amber: "border-amber-500", red: "border-red-500", "": "border-border" };

const Toggle = ({ options, value, onChange, testid }) => (
  <div className="inline-flex overflow-hidden rounded-md border border-border" data-testid={testid}>
    {options.map((o) => (
      <button key={o} type="button" data-testid={`${testid}-${o.toLowerCase()}`} onClick={() => onChange(o)}
        className={`h-9 px-3 text-sm font-semibold ${value === o ? "bg-primary text-white" : "bg-white text-muted-foreground hover:bg-muted"}`}>{o}</button>
    ))}
  </div>
);

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
                <span className="text-xs font-semibold text-muted-foreground">{m.label}</span>
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
  const [metric, setMetric] = useState("weight");
  const [standard, setStandard] = useState(entries[0]?.standard || "WHO");
  const [mode, setMode] = useState("Percentile");

  const rows = useMemo(() => {
    const out = [];
    entries.forEach((e) => {
      const ageMo = e.ageMonths != null ? e.ageMonths : monthsBetween(dob, e.date);
      Object.entries(e.measures || {}).forEach(([k, val]) => {
        if (!val) return;
        const r = compute({ metric: k, value: val, ageMonths: ageMo, sex, standard: e.standard || standard });
        out.push({ date: e.date, ageMo, metric: k, value: val, ...r });
      });
      const bmi = bmiFrom(e.measures?.weight, e.measures?.height);
      if (bmi && ageMo >= 24) { const r = compute({ metric: "bmi", value: bmi, ageMonths: ageMo, sex, standard: e.standard || standard }); out.push({ date: e.date, ageMo, metric: "bmi", value: bmi, ...r }); }
    });
    return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [entries, dob, sex, standard]);

  const graph = useMemo(() => {
    const points = rows.filter((r) => r.metric === metric).map((r) => ({ age: Math.round((r.ageMo / 12) * 10) / 10, value: Number(r.value) }));
    const minMo = Math.max(0, Math.min(...points.map((p) => p.age * 12), 0));
    const maxMo = Math.max(24, ...points.map((p) => p.age * 12 + 6));
    const ref = referenceSeries(metric, sex, standard, minMo, Math.min(216, maxMo), 6);
    const byAge = {};
    ref.forEach((p) => { byAge[p.age] = { ...p }; });
    points.forEach((p) => { byAge[p.age] = { ...(byAge[p.age] || { age: p.age }), value: p.value }; });
    return Object.values(byAge).sort((a, b) => a.age - b.age);
  }, [rows, metric, sex, standard]);

  const mLabel = GROWTH_METRICS.find((m) => m.k === metric)?.label || metric;

  return (
    <div className="space-y-4" data-testid={testid}>
      <div className="flex flex-wrap items-center gap-3">
        <Toggle options={STANDARDS} value={standard} onChange={setStandard} testid={`${testid}-standard`} />
        <Toggle options={GROWTH_MODES} value={mode} onChange={setMode} testid={`${testid}-mode`} />
      </div>

      <div className="flex flex-wrap gap-2">
        {GROWTH_METRICS.map((m) => (
          <button key={m.k} type="button" onClick={() => setMetric(m.k)} data-testid={`${testid}-metric-${m.k}`}
            className={`h-9 rounded-full border px-3 text-sm font-semibold ${metric === m.k ? "border-primary bg-primary text-white" : "border-border bg-white hover:bg-muted"}`}>{m.label}</button>
        ))}
      </div>

      <div className="h-64 w-full rounded-lg border border-border bg-white p-2" data-testid={`${testid}-graph`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={graph} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef" />
            <XAxis dataKey="age" tick={{ fontSize: 11 }} label={{ value: "Age (yr)", position: "insideBottom", offset: -2, fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="p2" name="+2SD" stroke="#f59e0b" dot={false} strokeWidth={1} />
            <Line type="monotone" dataKey="median" name="Median" stroke="#94a3b8" dot={false} strokeWidth={1} />
            <Line type="monotone" dataKey="m2" name="-2SD" stroke="#f59e0b" dot={false} strokeWidth={1} />
            <Line type="monotone" dataKey="value" name={mLabel} stroke="#0F52BA" strokeWidth={2.5} connectNulls dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid={`${testid}-table`}>
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-semibold">Date / time</th>
              <th className="px-2 py-2 font-semibold">Age</th>
              <th className="px-2 py-2 font-semibold">Metric</th>
              <th className="px-2 py-2 font-semibold">Value</th>
              <th className="px-2 py-2 font-semibold">Pctile (SD)</th>
              <th className="px-2 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="py-3 text-muted-foreground">No measurements recorded yet.</td></tr>}
            {rows.map((r, i) => {
              const m = GROWTH_METRICS.find((x) => x.k === r.metric);
              return (
                <tr key={i} className="border-b border-border/60" data-testid={`${testid}-row-${i}`}>
                  <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(r.date)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{ageMonthsToLabel(r.ageMo)}</td>
                  <td className="px-2 py-2">{m?.label || r.metric}</td>
                  <td className="px-2 py-2 font-semibold tabular-nums">{r.value} {m?.unit}</td>
                  <td className="px-2 py-2 tabular-nums">{percentileLabel(r.percentile)} ({r.z > 0 ? "+" : ""}{r.z} SD)</td>
                  <td className="px-2 py-2"><span className={`inline-flex items-center gap-1.5 font-semibold ${txt[r.status]}`}><span className={`h-2.5 w-2.5 rounded-full ${dot[r.status]}`} />{r.status || "—"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
