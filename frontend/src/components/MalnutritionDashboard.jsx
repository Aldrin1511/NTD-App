import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { AlertPanel } from "@/components/Fields";
import { FeatureCard } from "@/components/EntryKit";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { fmtDate, fmtDateTime, groupDiseaseEpisodes } from "@/mock/specs";
import { ageMonthsToLabel } from "@/mock/growth";
import { MAL_ID, monitoringAlert } from "@/mock/malnutrition";
import { Pencil, Plus } from "lucide-react";

const dotCls = { red: "bg-red-500", amber: "bg-amber-500", green: "bg-green-500" };
const rowCls = { red: "bg-red-50", amber: "bg-amber-50", green: "" };

export default function MalnutritionDashboard({ patient, encounters, canEdit, onEdit, onAddVisit }) {
  const episode = useMemo(() => groupDiseaseEpisodes(encounters, MAL_ID, null)[0], [encounters]);
  const visits = useMemo(() => [...(episode?.visits || [])].sort((a, b) => String(a.date).localeCompare(String(b.date))), [episode]);
  if (!episode) return <AlertPanel level="info" title="No Malnutrition data yet" testid="mal-empty">Add an encounter and choose Malnutrition to start this record.</AlertPanel>;

  const admission = visits.find((v) => v.data?.visitType === "Admission") || visits[0];
  const monitoring = visits.filter((v) => v.data?.visitType === "Monitoring");
  const cd = admission?.data?.caseDetails || {};
  const outcome = [...visits].reverse().find((v) => v.data?.outcome?.status)?.data?.outcome;

  const maxWeek = Math.max(12, ...monitoring.map((v) => Number(v.data?.week) || 0));
  const weekRows = [];
  let prev = admission?.data || null;
  for (let w = 1; w <= maxWeek; w++) {
    const v = monitoring.find((x) => Number(x.data?.week) === w);
    const entry = v?.data;
    const alert = entry ? monitoringAlert(entry, prev) : null;
    weekRows.push({ w, v, entry, alert });
    if (entry) prev = entry;
  }

  const graph = [
    { x: "Adm", weight: Number(admission?.data?.weight) || null, target: Number(admission?.data?.targetWeight) || null, muac: Number(admission?.data?.muac) || null },
    ...weekRows.filter((r) => r.entry).map((r) => ({ x: `W${r.w}`, weight: Number(r.entry.weight) || null, target: Number(r.entry.targetWeight) || null, muac: Number(r.entry.muac) || null })),
  ];

  return (
    <div className="space-y-4" data-testid="mal-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-secondary px-4 py-3">
        <div>
          <p className="font-semibold">Malnutrition · Case #{cd.caseNo || "—"} · {cd.admissionType || "—"}</p>
          <p className="mt-0.5 text-xs font-medium text-secondary-foreground/80">Admitted {cd.admissionDate ? fmtDate(cd.admissionDate) : "—"} · {ageMonthsToLabel(admission?.data?.ageMonths)} · {cd.caseType || ""}{outcome ? ` · Outcome: ${outcome.status}` : " · Active"}</p>
        </div>
        {canEdit && <Button className="h-10" onClick={onAddVisit} data-testid="mal-add-visit"><Plus className="mr-1 h-4 w-4" /> Add monitoring</Button>}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[["Current wt", `${prev?.weight || "—"} kg`], ["Target wt", `${admission?.data?.targetWeight || "—"} kg`], ["MUAC", `${prev?.muac || "—"} cm`], ["Oedema", prev?.oedema || "—"]].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-white p-3"><p className="text-[11px] font-semibold text-muted-foreground">{k}</p><p className="text-lg font-bold">{v}</p></div>
        ))}
      </div>

      <FeatureCard title="Progress (weight & MUAC vs target)" testid="mal-feat-graph">
        <div className="h-64 w-full" data-testid="mal-graph">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={graph} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef" />
              <XAxis dataKey="x" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="target" name="Target wt" stroke="#94a3b8" strokeDasharray="5 4" dot={false} connectNulls />
              <Line type="monotone" dataKey="weight" name="Weight" stroke="#0F52BA" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="muac" name="MUAC" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </FeatureCard>

      <FeatureCard title="12-week monitoring schedule" count={monitoring.length} testid="mal-feat-monitoring">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="mal-monitoring-table">
            <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 pr-2 font-semibold">Week</th><th className="px-2 py-2 font-semibold">Date</th><th className="px-2 py-2 font-semibold">Visit</th><th className="px-2 py-2 font-semibold">Wt</th><th className="px-2 py-2 font-semibold">MUAC</th><th className="px-2 py-2 font-semibold">Oedema</th><th className="px-2 py-2 font-semibold">Alert</th><th className="px-2 py-2"></th>
            </tr></thead>
            <tbody>
              {weekRows.map((r) => (
                <tr key={r.w} className={`border-b border-border/60 ${r.alert ? rowCls[r.alert.level] : ""}`} data-testid={`mal-week-${r.w}`}>
                  <td className="py-2 pr-2 font-semibold">Week {r.w}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{r.v ? fmtDate(r.v.date) : "—"}</td>
                  <td className="px-2 py-2">{r.entry ? "Monitoring" : "Scheduled"}</td>
                  <td className="px-2 py-2 tabular-nums">{r.entry?.weight || "—"}</td>
                  <td className="px-2 py-2 tabular-nums">{r.entry?.muac || "—"}</td>
                  <td className="px-2 py-2">{r.entry?.oedema || "—"}</td>
                  <td className="px-2 py-2">{r.alert ? <span className="inline-flex items-center gap-1.5 font-semibold"><span className={`h-2.5 w-2.5 rounded-full ${dotCls[r.alert.level]}`} />{r.alert.level}</span> : "—"}</td>
                  <td className="px-2 py-2">{r.v && canEdit && <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => onEdit(r.v)} data-testid={`mal-edit-${r.v.id}`}><Pencil className="h-4 w-4" /></Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FeatureCard>

      {outcome && (
        <FeatureCard title="Case outcome" testid="mal-feat-outcome" defaultOpen>
          <p className="text-sm font-semibold">{outcome.status}</p>
          {outcome.status === "Recovered / Discharged" && <p className="text-sm text-muted-foreground">Final wt {outcome.finalWeight || "—"} kg · MUAC {outcome.finalMuac || "—"} cm · Oedema {outcome.finalOedema || "—"} · {outcome.finalClinical || ""}</p>}
          {outcome.status === "Transferred" && <p className="text-sm text-muted-foreground">To {[outcome.facility, outcome.district, outcome.province].filter(Boolean).join(", ")}</p>}
          {outcome.note && <p className="text-sm text-muted-foreground">{outcome.note}</p>}
        </FeatureCard>
      )}
    </div>
  );
}
